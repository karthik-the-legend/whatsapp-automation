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
  // Meta redelivers webhooks under real-world conditions (slow ack, network
  // blips) - waMessageId has a @unique constraint on Message specifically
  // so a redelivered message is never processed (and never replied to)
  // twice. Checked before any other work, including markAsRead.
  const alreadyProcessed = await conversationRepository.findMessageByWaMessageId(message.waMessageId);
  if (alreadyProcessed) {
    log.info('Duplicate webhook delivery ignored', { waMessageId: message.waMessageId });
    return;
  }

  await whatsappService.markAsRead(message.waMessageId);

  const conversation = await getOrCreateConversation(message.from);
  await conversationRepository.touch(conversation.id);

  const alreadyEscalated = conversation.status === 'HUMAN_ACTIVE' || conversation.status === 'ESCALATED';

  // Human handover check runs before any bot logic, from any state - but
  // if it's already escalated, re-running escalate() would overwrite the
  // original escalationReason/escalatedAt and re-send the full escalation
  // message. Fall through to the "already escalated" branch below instead.
  if (handoverService.isHandoverRequest(message.text) && !alreadyEscalated) {
    await conversationRepository.addMessage(conversation.id, 'INBOUND', message.text, { waMessageId: message.waMessageId });
    await handoverService.escalate(conversation.id, message.from, 'Explicit handover phrase detected');
    return;
  }

  // A human admin already owns this conversation - the bot must never
  // generate its own answer here, but it must also never go silent. Every
  // message is logged (for the admin's chat history view) AND gets a
  // short, honest "still with our team" acknowledgment.
  if (alreadyEscalated) {
    await conversationRepository.addMessage(conversation.id, 'INBOUND', message.text, { waMessageId: message.waMessageId });
    await handoverService.acknowledgeWhileEscalated(conversation.id, message.from);
    return;
  }

  await chatbotService.handleMessage(conversation.id, message.from, message.text, message.waMessageId);
}

export const whatsappWebhookHandler = { handleInboundMessage, getOrCreateConversation };
