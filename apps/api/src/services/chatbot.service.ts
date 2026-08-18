// apps/api/src/services/chatbot.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// This is the "Parent Enquiry Chatbot" from the spec. It runs a cheap,
// deterministic FAQ keyword match FIRST (fast, free, 100% on-brand answers
// for the common questions), and only falls through to the LLM for
// open-ended phrasing the FAQ list doesn't cover. If the LLM itself isn't
// confident, it escalates to a human rather than guessing - never robotic,
// never wrong with false confidence.
//
// Call order for every inbound WhatsApp message (after handoverService
// has already checked for an explicit "talk to admin" request):
//   1. matchFaq()          - deterministic, instant
//   2. askAi()             - LLM fallback, grounded in the same FAQ data
//   3. escalate if low confidence

import { Faq } from '@academy/db';
import { faqRepository } from '../repositories/faq.repository';
import { conversationRepository } from '../repositories/conversation.repository';
import { getAiProvider } from './ai/aiProviderFactory';
import { buildChatbotSystemPrompt } from '../prompts/systemPrompt';
import { handoverService } from './handover.service';
import { whatsappService } from './whatsapp.service';
import { logger } from '../config/logger';

const log = logger.child({ module: 'chatbot-service' });

const AI_CONFIDENCE_ESCALATION_THRESHOLD = 0.55;
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

async function askAi(conversationId: string, messageText: string) {
  const faqs = await faqRepository.findAllActive();
  const systemPrompt = buildChatbotSystemPrompt(faqs);
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
async function handleMessage(conversationId: string, phone: string, messageText: string) {
  await conversationRepository.addMessage(conversationId, 'INBOUND', messageText);

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

  const aiResult = await askAi(conversationId, messageText);

  if (aiResult.confidence < AI_CONFIDENCE_ESCALATION_THRESHOLD) {
    await handoverService.escalate(conversationId, phone, `Low AI confidence (${aiResult.confidence}) for: "${messageText}"`);
    await conversationRepository.addMessage(conversationId, 'OUTBOUND', '[escalated to human]', {
      confidence: aiResult.confidence,
    });
    return;
  }

  await whatsappService.sendText(phone, aiResult.text);
  await conversationRepository.addMessage(conversationId, 'OUTBOUND', aiResult.text, {
    confidence: aiResult.confidence,
  });
}

export const chatbotService = { matchFaq, askAi, handleMessage };
