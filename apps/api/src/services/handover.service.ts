// apps/api/src/services/handover.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// "Talk to Admin" / "Call Me" must work from ANY state in the conversation,
// not just as a chatbot-recognized intent - a parent mid-frustration typing
// in caps shouldn't get a confused bot reply. This is checked FIRST, before
// intent classification or FAQ matching, in the webhook handler.

const HANDOVER_PHRASES = [
  'talk to admin',
  'talk to a human',
  'call me',
  'speak to someone',
  'human please',
  'talk to owner',
  'connect me to admin',
];

function isHandoverRequest(messageText: string): boolean {
  const normalized = messageText.trim().toLowerCase();
  return HANDOVER_PHRASES.some((phrase) => normalized.includes(phrase));
}

import { conversationRepository } from '../repositories/conversation.repository';
import { whatsappService } from './whatsapp.service';
import { logger } from '../config/logger';

const log = logger.child({ module: 'handover-service' });

/**
 * Escalates a conversation to a human admin. Chat history stays fully
 * intact and visible (see conversationRepository.history) - the bot simply
 * stops auto-replying until an admin closes or hands it back.
 */
async function escalate(conversationId: string, phone: string, reason: string) {
  await conversationRepository.escalate(conversationId, reason);

  await whatsappService.sendText(
    phone,
    "I've let our team know you'd like to speak with someone directly. " +
      "An admin will reply here shortly - thanks for your patience! 🙏",
  );

  log.info('Conversation escalated to human', { conversationId, reason });

  // TODO (Blue/Black Belt): push a notification to the admin dashboard /
  // a staff WhatsApp group so escalations are seen in real time, not just
  // polled from the admin inbox.
}

export const handoverService = { isHandoverRequest, escalate };
