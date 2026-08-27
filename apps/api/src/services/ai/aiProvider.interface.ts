// apps/api/src/services/ai/aiProvider.interface.ts
//
// One contract, swappable implementations. This is the file that makes
// "Claude vs OpenAI" a one-line config change (AI_PROVIDER env var) instead
// of a rewrite - see aiProviderFactory.ts.

export interface AiCompletionRequest {
  systemPrompt: string;
  userMessage: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
}

/**
 * Explicit decision the model makes about its own reply, alongside the reply
 * text itself - replaces a bare confidence-threshold gate (which collapsed
 * "I genuinely don't know this specific fact" and "this needs a human" into
 * the same "escalate" outcome). See chatbot.service.ts for how each is handled.
 *
 * - ANSWER: it can genuinely help - grounded academy fact, general
 *   conversation/knowledge, or a natural clarifying question. Sent as-is.
 * - MISSING_DATA: a real academy-specific fact was asked for that isn't in
 *   what the model was given. Still sent as-is - the model is instructed to
 *   say so honestly rather than invent the answer or claim a human will follow up.
 * - ESCALATE: genuinely needs a human (account-specific data, a complaint,
 *   a dispute) - triggers handoverService.escalate() instead of sending the text.
 */
export type AiDecision = 'ANSWER' | 'MISSING_DATA' | 'ESCALATE';

export interface AiCompletionResult {
  text: string;
  decision: AiDecision;
  /** 0-1, logged for observability - no longer what gates escalation, `decision` is. */
  confidence: number;
}

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
