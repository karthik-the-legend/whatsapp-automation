// apps/api/src/services/chatbot.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// This is the "Parent Enquiry Chatbot" from the spec. It runs a cheap,
// deterministic FAQ keyword match FIRST (fast, free, 100% on-brand answers
// for the common questions), and only falls through to the LLM for
// open-ended phrasing the FAQ list doesn't cover. The LLM makes an explicit
// ANSWER/MISSING_DATA/ESCALATE decision about its own reply (see
// AiDecision) rather than a bare confidence number gating escalation -
// a low-confidence-but-honest "I don't have that specific detail" answer
// is still sent to the customer, never silently swallowed.
//
// Call order for every inbound WhatsApp message (after handoverService
// has already checked for an explicit "talk to admin" request):
//   1. matchFaq()          - deterministic, instant
//   2. askAi()              - LLM fallback, grounded in FAQ text + real batch schedule data
//   3. act on aiResult.decision (ANSWER/MISSING_DATA both reply normally, ESCALATE hands off)
//
// If the AI call itself fails (bad key, timeout, quota) handleMessage
// catches it and sends an honest fallback reply - see the try/catch below.
// This must never be silent either.

import { Faq } from '@academy/db';
import { faqRepository } from '../repositories/faq.repository';
import { batchRepository } from '../repositories/batch.repository';
import { conversationRepository } from '../repositories/conversation.repository';
import { getAiProvider } from './ai/aiProviderFactory';
import { AiCompletionResult } from './ai/aiProvider.interface';
import { buildChatbotSystemPrompt } from '../prompts/systemPrompt';
import { handoverService } from './handover.service';
import { whatsappService } from './whatsapp.service';
import { logger } from '../config/logger';

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

async function askAi(conversationId: string, messageText: string): Promise<AiCompletionResult> {
  const [faqs, batches] = await Promise.all([faqRepository.findAllActive(), batchRepository.findAll()]);
  const systemPrompt = buildChatbotSystemPrompt(faqs, batches);
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

/**
 * Main entry point, called by the webhook handler for every inbound text
 * message once handoverService.isHandoverRequest() has already returned
 * false for this message.
 */
async function handleMessage(conversationId: string, phone: string, messageText: string, waMessageId?: string) {
  await conversationRepository.addMessage(conversationId, 'INBOUND', messageText, { waMessageId });

  const faqMatch = await matchFaq(messageText);
  if (faqMatch) {
    await whatsappService.sendText(phone, faqMatch.answer);
    await conversationRepository.addMessage(conversationId, 'OUTBOUND', faqMatch.answer, {
      intent: faqMatch.category,
      confidence: 1,
    });
    await conversationRepository.setIntent(conversationId, faqMatch.category);
    log.info('Resolved via FAQ match', { conversationId, category: faqMatch.category });
    return;
  }

  let aiResult: AiCompletionResult;
  try {
    aiResult = await askAi(conversationId, messageText);
  } catch (err: any) {
    log.error('AI provider failed - sending honest fallback instead of staying silent', {
      conversationId,
      error: err.message,
    });
    await whatsappService.sendText(phone, AI_FALLBACK_MESSAGE);
    await conversationRepository.addMessage(conversationId, 'OUTBOUND', AI_FALLBACK_MESSAGE, { confidence: 0 });
    return;
  }

  if (aiResult.decision === 'ESCALATE') {
    // handoverService.escalate() sends and persists its own outbound
    // message - nothing further to send here.
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
  await whatsappService.sendText(phone, aiResult.text);
  await conversationRepository.addMessage(conversationId, 'OUTBOUND', aiResult.text, {
    confidence: aiResult.confidence,
    intent: aiResult.decision,
  });
  log.info('Resolved via AI', { conversationId, decision: aiResult.decision, confidence: aiResult.confidence });
}

export const chatbotService = { matchFaq, askAi, handleMessage };
