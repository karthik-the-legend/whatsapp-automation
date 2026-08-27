// apps/api/src/repositories/conversation.repository.ts

import { prisma, Conversation, MessageDirection } from '@academy/db';

async function findOpenByPhone(phone: string): Promise<Conversation | null> {
  return prisma.conversation.findFirst({
    where: { phone, status: { in: ['BOT', 'ESCALATED', 'HUMAN_ACTIVE'] } },
    orderBy: { lastMessageAt: 'desc' },
  });
}

async function createForPhone(phone: string, studentId?: string, customerId?: string): Promise<Conversation> {
  return prisma.conversation.create({ data: { phone, studentId, customerId } });
}

async function touch(id: string) {
  return prisma.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } });
}

async function setIntent(id: string, intent: string) {
  return prisma.conversation.update({ where: { id }, data: { currentIntent: intent } });
}

async function escalate(id: string, reason: string) {
  return prisma.conversation.update({
    where: { id },
    data: { status: 'ESCALATED', escalatedAt: new Date(), escalationReason: reason },
  });
}

async function assignAdmin(id: string, adminId: string) {
  return prisma.conversation.update({
    where: { id },
    data: { status: 'HUMAN_ACTIVE', assignedAdminId: adminId },
  });
}

async function close(id: string) {
  return prisma.conversation.update({ where: { id }, data: { status: 'CLOSED' } });
}

async function addMessage(
  conversationId: string,
  direction: MessageDirection,
  body: string,
  meta: { intent?: string; confidence?: number; waMessageId?: string } = {},
) {
  return prisma.message.create({
    data: { conversationId, direction, body, ...meta },
  });
}

async function history(conversationId: string, limit = 20) {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/** Idempotency check - a Meta webhook retry must never be processed twice. See waMessageId's @unique constraint on Message. */
async function findMessageByWaMessageId(waMessageId: string) {
  return prisma.message.findUnique({ where: { waMessageId } });
}

async function findEscalatedQueue() {
  return prisma.conversation.findMany({
    where: { status: 'ESCALATED' },
    orderBy: { escalatedAt: 'asc' },
    include: { student: true, messages: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });
}

export const conversationRepository = {
  findOpenByPhone,
  createForPhone,
  touch,
  setIntent,
  escalate,
  assignAdmin,
  close,
  addMessage,
  history,
  findEscalatedQueue,
  findMessageByWaMessageId,
};
