// apps/api/src/services/conversation.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Escalating a conversation (handover.service.ts) previously had no
// counterpart - nothing in the app could ever mark one resolved, so
// ESCALATED was a practically-terminal state (see the Phase 1 audit).
// This is the minimal admin-facing capability that closes that gap:
// list what's waiting, and resolve one so the customer's next message
// starts a fresh bot-handled conversation (conversationRepository's
// findOpenByPhone excludes CLOSED, so this is all "resuming" requires).

import { conversationRepository } from '../repositories/conversation.repository';
import { ApiError } from '../plugins/errorHandler.plugin';

async function listEscalated() {
  return conversationRepository.findEscalatedQueue();
}

async function resolve(conversationId: string) {
  try {
    return await conversationRepository.close(conversationId);
  } catch (err: any) {
    if (err.code === 'P2025') throw new ApiError(404, 'Conversation not found');
    throw err;
  }
}

export const conversationService = { listEscalated, resolve };
