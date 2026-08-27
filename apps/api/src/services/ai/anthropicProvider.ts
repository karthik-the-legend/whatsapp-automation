// apps/api/src/services/ai/anthropicProvider.ts
//
// Concrete implementation of AiProvider using the Anthropic API. Per the
// stack rationale doc: this is a FALLBACK layer for open-ended questions
// the FAQ matcher can't handle - it must never take an action (no booking,
// no payment) and must hand off to a human whenever it isn't confident.

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import { AiProvider, AiCompletionRequest, AiCompletionResult } from './aiProvider.interface';
import { parseDecisionMarkers } from './parseDecisionMarkers';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export const anthropicProvider: AiProvider = {
  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    // The DECISION/CONFIDENCE marker instructions already live in
    // request.systemPrompt (see buildChatbotSystemPrompt) - every provider
    // shares the exact same instructions so parseDecisionMarkers works
    // identically regardless of which one is active.
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: request.maxTokens ?? 400,
      system: request.systemPrompt,
      messages: [
        ...request.conversationHistory,
        { role: 'user', content: request.userMessage },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '';

    return parseDecisionMarkers(rawText);
  },
};
