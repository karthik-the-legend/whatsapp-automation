// apps/api/src/services/chatbot.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// This is the "Parent Enquiry Chatbot" from the spec. Three layers, checked
// in order, each more expensive/less certain than the last:
//   1. businessQueryService.answer() - deterministic, real KFA structured
//      data (schedules/fees/belts/personal training/JKD quick facts). This
//      is the authority for anything with exactly one correct answer -
//      never generated, never at risk of confusing "monthly fee" with
//      "initial total" or inventing a day a batch doesn't run on.
//   2. matchFaq()                    - deterministic, exact-text FAQ rows
//      for everything else that has one fixed answer (contact/holidays/etc).
//   3. askAi()                       - LLM fallback for genuinely open-ended
//      questions (general JKD history/philosophy, small talk). Makes an
//      explicit ANSWER/MISSING_DATA/ESCALATE decision about its own reply
//      (see AiDecision) rather than a bare confidence number gating
//      escalation - a low-confidence-but-honest "I don't have that specific
//      detail" answer is still sent to the customer, never silently swallowed.
//
// If the AI call itself fails (bad key, timeout, quota) handleMessage
// catches it and sends an honest fallback reply - see the try/catch below.
// This must never be silent either.

import { Faq } from '@academy/db';
import { faqRepository } from '../repositories/faq.repository';
import { batchRepository } from '../repositories/batch.repository';
import { conversationRepository } from '../repositories/conversation.repository';
import { businessQueryService } from './businessQuery.service';
import { getAiProvider } from './ai/aiProviderFactory';
import { AiCompletionResult } from './ai/aiProvider.interface';
import { buildChatbotSystemPrompt } from '../prompts/systemPrompt';
import { detectGreeting } from '../utils/greetingDetector';
import { composeGreeting, composeGreetingPrefix } from '../prompts/greetingResponses';
import { handoverService } from './handover.service';
import { whatsappService } from './whatsapp.service';
import { logger } from '../config/logger';

export interface CustomerContext {
  isFirstInteraction: boolean;
  customerName: string | null;
  interactionCount: number;
}

const log = logger.child({ module: 'chatbot-service' });

const AI_FALLBACK_MESSAGE =
  "Sorry, I'm having a little trouble processing that right now - mind trying again in a moment? " +
  'If it keeps happening, reply "talk to admin" and our team will help directly.';

// Each FAQ's keyword list is topic-specific (not generic words), so a
// single hit is already a confident match - requiring 2 was rejecting
// ordinary short questions like "What are your fees?" which only
// naturally contains one topic keyword.
const FAQ_MATCH_MIN_SCORE = 1;

/** Simple, fast keyword-overlap scorer - deliberately not fuzzy/ML matching. */
/**
 * Whole-word keyword matching - deliberately NOT plain substring search.
 * A naive `text.includes(keyword)` would match "gi" (a UNIFORM keyword)
 * inside the word "gibberish", or "age" inside "manage" - false positives
 * that would send an FAQ answer for a completely unrelated message. Word
 * boundaries (\b) require the keyword to appear as its own word/phrase.
 */
function scoreFaqMatch(messageText: string, faq: Faq): number {
  const normalized = messageText.toLowerCase();
  return faq.keywords.reduce((score: number, kw: string) => {
    const escaped = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    return pattern.test(normalized) ? score + 1 : score;
  }, 0);
}

async function matchFaq(messageText: string): Promise<Faq | null> {
  const faqs = await faqRepository.findAllActive();
  let best: { faq: Faq; score: number } | null = null;

  for (const faq of faqs) {
    const score = scoreFaqMatch(messageText, faq);
    if (score >= FAQ_MATCH_MIN_SCORE && (!best || score > best.score)) {
      best = { faq, score };
    }
  }

  return best?.faq ?? null;
}

async function askAi(conversationId: string, messageText: string, customerContext?: CustomerContext): Promise<AiCompletionResult> {
  const [faqs, batches] = await Promise.all([faqRepository.findAllActive(), batchRepository.findAll()]);
  const systemPrompt = buildChatbotSystemPrompt(
    faqs,
    batches,
    customerContext
      ? { name: customerContext.customerName, isFirstInteraction: customerContext.isFirstInteraction, interactionCount: customerContext.interactionCount }
      : undefined,
  );
  const history = await conversationRepository.history(conversationId, 10);

  const conversationHistory = history
    .reverse()
    .map((m: { direction: string; body: string }) => ({
      role: (m.direction === 'INBOUND' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.body,
    }));

  const provider = getAiProvider();
  return provider.complete({ systemPrompt, userMessage: messageText, conversationHistory });
}

/** Sends `text` (with `prefix` prepended if given), persists the exact composed text, and logs. */
async function reply(conversationId: string, phone: string, text: string, prefix: string | null, meta: { intent: string; confidence: number }) {
  const composed = prefix ? `${prefix}\n\n${text}` : text;
  await whatsappService.sendText(phone, composed);
  await conversationRepository.addMessage(conversationId, 'OUTBOUND', composed, meta);
}

/**
 * Main entry point, called by the webhook handler for every inbound text
 * message once handoverService.isHandoverRequest() has already returned
 * false for this message. customerContext comes from customerService (see
 * whatsapp.webhook.ts) - it's what lets Neha introduce herself once and
 * never again, without needing the AI to track that itself.
 */
async function handleMessage(
  conversationId: string,
  phone: string,
  messageText: string,
  waMessageId?: string,
  customerContext?: CustomerContext,
) {
  await conversationRepository.addMessage(conversationId, 'INBOUND', messageText, { waMessageId });

  const { isGreeting, remainder } = detectGreeting(messageText);
  const greetingCtx = { isFirstInteraction: customerContext?.isFirstInteraction ?? false, name: customerContext?.customerName ?? null };

  // Pure greeting - nothing else to answer, so this is answered
  // deterministically (guarantees "Neha, receptionist at KFA" is stated
  // correctly on a first contact, and never restated to a returning one)
  // without spending an AI call or touching business/FAQ lookups at all.
  if (isGreeting && !remainder) {
    const text = composeGreeting(greetingCtx);
    await whatsappService.sendText(phone, text);
    await conversationRepository.addMessage(conversationId, 'OUTBOUND', text, { intent: 'GREETING', confidence: 1 });
    log.info('Resolved as pure greeting', { conversationId, isFirstInteraction: greetingCtx.isFirstInteraction });
    return;
  }

  // "Hi, what are the fees?" - answer the real question, just with a short
  // greeting lead-in prepended (mechanically, not left to the AI to
  // remember - the intro is a hard requirement, not a style choice).
  const greetingPrefix = isGreeting ? composeGreetingPrefix(greetingCtx) : null;
  const effectiveText = isGreeting ? remainder : messageText;

  const businessAnswer = await businessQueryService.answer(effectiveText);
  if (businessAnswer) {
    await reply(conversationId, phone, businessAnswer.text, greetingPrefix, { intent: businessAnswer.intent, confidence: 1 });
    log.info('Resolved via deterministic business data', { conversationId, intent: businessAnswer.intent, greeted: isGreeting });
    return;
  }

  const faqMatch = await matchFaq(effectiveText);
  if (faqMatch) {
    await reply(conversationId, phone, faqMatch.answer, greetingPrefix, { intent: faqMatch.category, confidence: 1 });
    await conversationRepository.setIntent(conversationId, faqMatch.category);
    log.info('Resolved via FAQ match', { conversationId, category: faqMatch.category, greeted: isGreeting });
    return;
  }

  let aiResult: AiCompletionResult;
  try {
    aiResult = await askAi(conversationId, effectiveText, customerContext);
  } catch (err: any) {
    log.error('AI provider failed - sending honest fallback instead of staying silent', {
      conversationId,
      error: err.message,
    });
    await reply(conversationId, phone, AI_FALLBACK_MESSAGE, greetingPrefix, { intent: 'AI_ERROR', confidence: 0 });
    return;
  }

  if (aiResult.decision === 'ESCALATE') {
    // handoverService.escalate() sends and persists its own outbound
    // message - nothing further to send here. A greeting prefix isn't
    // worth layering onto an escalation ack, so it's intentionally dropped.
    await handoverService.escalate(
      conversationId,
      phone,
      `AI escalation (confidence ${aiResult.confidence}) for: "${messageText}"`,
    );
    return;
  }

  // ANSWER and MISSING_DATA both reply normally - the distinction lives in
  // what the model was instructed to say (see buildChatbotSystemPrompt),
  // not in a different code path. `intent` records which one for observability.
  await reply(conversationId, phone, aiResult.text, greetingPrefix, { intent: aiResult.decision, confidence: aiResult.confidence });
  log.info('Resolved via AI', { conversationId, decision: aiResult.decision, confidence: aiResult.confidence, greeted: isGreeting });
}

export const chatbotService = { matchFaq, askAi, handleMessage };
