// apps/api/src/services/ai/openaiProvider.ts
//
// Alternative AiProvider implementation. Swapping AI_PROVIDER=openai in
// .env routes every chatbot call here instead of anthropicProvider - no
// other file changes.

import OpenAI from 'openai';
import { env } from '../../config/env';
import { AiProvider, AiCompletionRequest, AiCompletionResult } from './aiProvider.interface';
import { parseDecisionMarkers } from './parseDecisionMarkers';

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const openaiProvider: AiProvider = {
  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    // The DECISION/CONFIDENCE marker instructions already live in
    // request.systemPrompt - see anthropicProvider.ts for why.
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: request.maxTokens ?? 400,
      messages: [
        { role: 'system', content: request.systemPrompt },
        ...request.conversationHistory,
        { role: 'user', content: request.userMessage },
      ],
    });

    const rawText = response.choices[0]?.message?.content ?? '';
    return parseDecisionMarkers(rawText);
  },
};
