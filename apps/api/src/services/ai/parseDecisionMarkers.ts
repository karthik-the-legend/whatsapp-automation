// apps/api/src/services/ai/parseDecisionMarkers.ts
//
// Shared by every AiProvider implementation - each one asks its model to
// end its reply with the same two machine-parseable markers (see
// buildChatbotSystemPrompt), so parsing them out lives in one place instead
// of being copy-pasted into anthropicProvider/openaiProvider/geminiProvider.

import { AiDecision } from './aiProvider.interface';

const MARKERS = /\[DECISION:\s*(ANSWER|MISSING_DATA|ESCALATE)\]\s*\[CONFIDENCE:\s*([0-9.]+)\]\s*$/i;

const VALID_DECISIONS: AiDecision[] = ['ANSWER', 'MISSING_DATA', 'ESCALATE'];

export function parseDecisionMarkers(rawText: string): { text: string; decision: AiDecision; confidence: number } {
  const match = rawText.match(MARKERS);

  if (!match) {
    // Model didn't follow the format (happens occasionally with any LLM) -
    // fail toward safety: treat as ESCALATE rather than guessing ANSWER,
    // since we can't confirm the model itself thought it was safe to answer.
    return { text: rawText.trim(), decision: 'ESCALATE', confidence: 0 };
  }

  const decisionRaw = match[1].toUpperCase();
  const decision = VALID_DECISIONS.includes(decisionRaw as AiDecision) ? (decisionRaw as AiDecision) : 'ESCALATE';
  const confidence = parseFloat(match[2]);

  return {
    text: rawText.replace(MARKERS, '').trim(),
    decision,
    confidence: Number.isFinite(confidence) ? confidence : 0.5,
  };
}
