// apps/api/src/services/ai/openaiProvider.ts
//
// Alternative AiProvider implementation. Swapping AI_PROVIDER=openai in
// .env routes every chatbot call here instead of anthropicProvider - no
// other file changes.

import OpenAI from 'openai';
import { env } from '../../config/env';
import { AiProvider, AiCompletionRequest, AiCompletionResult } from './aiProvider.interface';

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const CONFIDENCE_MARKER = /\[CONFIDENCE:\s*([0-9.]+)\]\s*$/;

export const openaiProvider: AiProvider = {
  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: request.maxTokens ?? 400,
      messages: [
        {
          role: 'system',
          content: `${request.systemPrompt}\n\nEnd every reply with a confidence marker on its own line, exactly in the form: [CONFIDENCE: 0.0-1.0]. Use 0.3 or lower if the question needs academy-specific data you weren't given.`,
        },
        ...request.conversationHistory,
        { role: 'user', content: request.userMessage },
      ],
    });

    const rawText = response.choices[0]?.message?.content ?? '';
    const match = rawText.match(CONFIDENCE_MARKER);
    const confidence = match ? parseFloat(match[1]) : 0.5;
    const text = rawText.replace(CONFIDENCE_MARKER, '').trim();

    return { text, confidence: Number.isFinite(confidence) ? confidence : 0.5 };
  },
};
