// apps/api/src/webhooks/whatsapp.webhook.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// The actual Fastify route + HMAC signature verification (X-Hub-Signature-256)
// is intentionally NOT in this file - that's pure webhook plumbing and
// belongs in a route-level plugin so it runs before JSON body parsing.
// This file is the orchestration layer the route hands off to once a
// verified message payload has arrived: it decides handover vs chatbot vs
// simple status-update ack, and nothing else in the app should contain
// this decision tree.

import { conversationRepository } from '../repositories/conversation.repository';
import { studentRepository } from '../repositories/student.repository';
import { handoverService } from '../services/handover.service';
import { chatbotService } from '../services/chatbot.service';
import { whatsappService } from '../services/whatsapp.service';
import { logger } from '../config/logger';

const log = logger.child({ module: 'whatsapp-webhook' });

interface InboundTextMessage {
  from: string; // WhatsApp phone number, already E.164
  waMessageId: string;
  text: string;
}

async function getOrCreateConversation(phone: string) {
  const existing = await conversationRepository.findOpenByPhone(phone);
  if (existing) return existing;

  const student = await studentRepository.findByPhone(phone);
  return conversationRepository.createForPhone(phone, student?.id);
}

/**
 * Called once per inbound text message, after the route's HMAC check has
 * already verified the payload came from Meta.
 */
async function handleInboundMessage(message: InboundTextMessage): Promise<void> {
  await whatsappService.markAsRead(message.waMessageId);

  const conversation = await getOrCreateConversation(message.from);
  await conversationRepository.touch(conversation.id);

  // Human handover check runs FIRST, before any bot logic, from any state.
  if (handoverService.isHandoverRequest(message.text)) {
    await conversationRepository.addMessage(conversation.id, 'INBOUND', message.text);
    await handoverService.escalate(conversation.id, message.from, 'Explicit handover phrase detected');
    return;
  }

  // If a human admin already has this conversation, the bot stays silent -
  // messages are still logged (for the admin's chat history view) but no
  // auto-reply is sent.
  if (conversation.status === 'HUMAN_ACTIVE' || conversation.status === 'ESCALATED') {
    await conversationRepository.addMessage(conversation.id, 'INBOUND', message.text);
    log.info('Message received during human handoff - no bot reply sent', { conversationId: conversation.id });
    return;
  }

  await chatbotService.handleMessage(conversation.id, message.from, message.text);
}

export const whatsappWebhookHandler = { handleInboundMessage, getOrCreateConversation };
