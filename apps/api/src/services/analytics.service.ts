// apps/api/src/services/analytics.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Covers spec item #13. Every function here is a read-only aggregation
// query for the admin dashboard - no mutation, no side effects. Kept
// separate from the domain services (student/payment/attendance) so a
// slow reporting query can never accidentally share a code path with a
// hot write path used by the webhook handler.

import { prisma } from '@academy/db';

async function dailyEnquiries(date: Date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return prisma.conversation.count({ where: { createdAt: { gte: start, lte: end } } });
}

async function admissionsThisMonth(reference: Date = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 23, 59, 59);
  return prisma.student.count({ where: { joiningDate: { gte: start, lte: end } } });
}

async function attendancePercentage(batchId: string, from: Date, to: Date): Promise<number> {
  const [present, total] = await Promise.all([
    prisma.attendance.count({ where: { batchId, date: { gte: from, lte: to }, status: 'PRESENT' } }),
    prisma.attendance.count({ where: { batchId, date: { gte: from, lte: to } } }),
  ]);
  return total === 0 ? 0 : Math.round((present / total) * 100);
}

async function feeCollectionThisMonth(reference: Date = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 23, 59, 59);
  const result = await prisma.payment.aggregate({
    where: { status: 'PAID', paidAt: { gte: start, lte: end } },
    _sum: { amountPaid: true },
  });
  return result._sum.amountPaid ?? 0;
}

async function outstandingPayments() {
  const result = await prisma.payment.aggregate({
    where: { status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
    _sum: { amount: true },
    _count: true,
  });
  return { totalOutstanding: result._sum.amount ?? 0, count: result._count };
}

async function chatbotPerformance(from: Date, to: Date) {
  const [total, escalated] = await Promise.all([
    prisma.conversation.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.conversation.count({ where: { createdAt: { gte: from, lte: to }, status: { in: ['ESCALATED', 'HUMAN_ACTIVE'] } } }),
  ]);
  return {
    totalConversations: total,
    escalatedConversations: escalated,
    autoResolvedRate: total === 0 ? 0 : Math.round(((total - escalated) / total) * 100),
  };
}

async function frequentlyAskedTopics(from: Date, to: Date, limit = 10) {
  const grouped = await prisma.message.groupBy({
    by: ['intent'],
    where: { createdAt: { gte: from, lte: to }, direction: 'INBOUND', intent: { not: null } },
    _count: true,
    orderBy: { _count: { intent: 'desc' } },
    take: limit,
  });
  return grouped.map((g: { intent: string | null; _count: number }) => ({ intent: g.intent, count: g._count }));
}

async function broadcastDeliveryStatus(limit = 20) {
  return prisma.broadcastLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
}

async function studentGrowth(months = 6) {
  // Simple month-bucketed count of joins over the last N months.
  const results: Array<{ month: string; count: number }> = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    // eslint-disable-next-line no-await-in-loop
    const count = await prisma.student.count({ where: { joiningDate: { gte: start, lte: end } } });
    results.push({ month: start.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }), count });
  }
  return results;
}

export const analyticsService = {
  dailyEnquiries,
  admissionsThisMonth,
  attendancePercentage,
  feeCollectionThisMonth,
  outstandingPayments,
  chatbotPerformance,
  frequentlyAskedTopics,
  broadcastDeliveryStatus,
  studentGrowth,
};
