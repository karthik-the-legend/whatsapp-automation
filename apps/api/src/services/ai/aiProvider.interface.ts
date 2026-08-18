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

export interface AiCompletionResult {
  text: string;
  /** 0-1 confidence that the reply actually answers the question (self-reported by prompt). */
  confidence: number;
}

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
