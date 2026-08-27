// apps/api/src/services/ai/geminiProvider.ts
//
// Alternative AiProvider implementation using Google's Gemini API (the
// free-tier-friendly option - see AI_PROVIDER=gemini in .env). No other
// file changes needed to switch to it.

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../config/env';
import { AiProvider, AiCompletionRequest, AiCompletionResult } from './aiProvider.interface';
import { parseDecisionMarkers } from './parseDecisionMarkers';

const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export const geminiProvider: AiProvider = {
  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    // The DECISION/CONFIDENCE marker instructions already live in
    // request.systemPrompt - see anthropicProvider.ts for why.
    const model = client.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: request.systemPrompt,
    });

    // Gemini's chat history uses 'model' where the rest of this codebase
    // (and the other two providers) use 'assistant' - translate at the edge
    // so aiProvider.interface.ts can stay provider-agnostic.
    const chat = model.startChat({
      history: request.conversationHistory.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      // gemini-3.6-flash is a reasoning model - its internal "thinking"
      // tokens count against maxOutputTokens and are spent BEFORE the
      // visible reply, so a low budget here truncates the reply before it
      // ever reaches the [DECISION]/[CONFIDENCE] markers at the end
      // (confirmed via direct testing: a 400-token budget cut replies off
      // mid-sentence). This SDK version has no thinkingConfig to disable
      // reasoning outright, so the fix is generous headroom instead.
      generationConfig: { maxOutputTokens: request.maxTokens ?? 1536 },
    });

    const result = await chat.sendMessage(request.userMessage);
    const rawText = result.response.text();

    return parseDecisionMarkers(rawText);
  },
};
