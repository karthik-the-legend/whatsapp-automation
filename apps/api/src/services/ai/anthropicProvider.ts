// apps/api/src/services/ai/anthropicProvider.ts
//
// Concrete implementation of AiProvider using the Anthropic API. Per the
// stack rationale doc: this is a FALLBACK layer for open-ended questions
// the FAQ matcher can't handle - it must never take an action (no booking,
// no payment) and must hand off to a human whenever it isn't confident.

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import { AiProvider, AiCompletionRequest, AiCompletionResult } from './aiProvider.interface';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Asking the model to self-report confidence and to end its answer with a
// machine-parseable marker keeps the escalation decision cheap (no second
// classification call) - see chatbot.service.ts for how CONFIDENCE is read.
const CONFIDENCE_MARKER = /\[CONFIDENCE:\s*([0-9.]+)\]\s*$/;

export const anthropicProvider: AiProvider = {
  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: request.maxTokens ?? 400,
      system: `${request.systemPrompt}\n\nEnd every reply with a confidence marker on its own line, exactly in the form: [CONFIDENCE: 0.0-1.0], reflecting how certain you are that your answer fully and correctly resolves the parent's question using ONLY the academy information you were given. If the question needs information you weren't given (a specific student's record, a payment issue, anything requiring academy data you don't have), give confidence 0.3 or lower.`,
      messages: [
        ...request.conversationHistory,
        { role: 'user', content: request.userMessage },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '';

    const match = rawText.match(CONFIDENCE_MARKER);
    const confidence = match ? parseFloat(match[1]) : 0.5;
    const text = rawText.replace(CONFIDENCE_MARKER, '').trim();

    return { text, confidence: Number.isFinite(confidence) ? confidence : 0.5 };
  },
};
