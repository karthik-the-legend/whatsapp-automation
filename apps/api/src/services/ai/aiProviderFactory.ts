// apps/api/src/services/ai/aiProviderFactory.ts

import { env } from '../../config/env';
import { AiProvider } from './aiProvider.interface';
import { anthropicProvider } from './anthropicProvider';
import { openaiProvider } from './openaiProvider';
import { geminiProvider } from './geminiProvider';

export function getAiProvider(): AiProvider {
  switch (env.AI_PROVIDER) {
    case 'openai':
      return openaiProvider;
    case 'gemini':
      return geminiProvider;
    case 'anthropic':
    default:
      return anthropicProvider;
  }
}
