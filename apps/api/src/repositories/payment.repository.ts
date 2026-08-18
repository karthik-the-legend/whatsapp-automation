// apps/api/src/repositories/payment.repository.ts

import { prisma, Payment, Prisma, FeeReminderStage } from '@academy/db';

async function create(data: Prisma.PaymentCreateInput): Promise<Payment> {
  return prisma.payment.create({ data });
}

async function update(id: string, data: Prisma.PaymentUpdateInput): Promise<Payment> {
  return prisma.payment.update({ where: { id }, data });
}

async function findById(id: string) {
  return prisma.payment.findUnique({ where: { id }, include: { student: { include: { batch: true } } } });
}

async function findByGatewayOrderId(gatewayOrderId: string) {
  return prisma.payment.findFirst({ where: { gatewayOrderId } });
}

async function findHistoryForStudent(studentId: string) {
  return prisma.payment.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } });
}

/** Payments due N days from now that have NOT yet had `stage` sent - fee reminder job. */
async function findDueForReminderStage(daysFromNow: number, stage: FeeReminderStage) {
  const start = new Date();
  start.setDate(start.getDate() + daysFromNow);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return prisma.payment.findMany({
    where: {
      status: { in: ['PENDING', 'PARTIAL'] },
      dueDate: { gte: start, lte: end },
      NOT: { remindersSent: { has: stage } },
    },
    include: { student: { include: { batch: true } } },
  });
}

/** Payments past due date and not yet flagged OVERDUE - run daily to update status. */
async function findNewlyOverdue() {
  return prisma.payment.findMany({
    where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: new Date() } },
  });
}

async function markReminderSent(id: string, stage: FeeReminderStage) {
  return prisma.payment.update({
    where: { id },
    data: { remindersSent: { push: stage } },
  });
}

async function outstandingTotal() {
  const result = await prisma.payment.aggregate({
    where: { status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export const paymentRepository = {
  create,
  update,
  findById,
  findByGatewayOrderId,
  findHistoryForStudent,
  findDueForReminderStage,
  findNewlyOverdue,
  markReminderSent,
  outstandingTotal,
};
