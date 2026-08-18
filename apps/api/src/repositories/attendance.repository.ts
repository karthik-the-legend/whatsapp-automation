// apps/api/src/repositories/attendance.repository.ts

import { prisma, Attendance, AttendanceStatus } from '@academy/db';

async function mark(studentId: string, batchId: string, date: Date, status: AttendanceStatus, markedBy?: string) {
  return prisma.attendance.upsert({
    where: { studentId_date: { studentId, date } },
    create: { studentId, batchId, date, status, markedBy },
    update: { status, markedBy },
  });
}

async function findForDate(batchId: string, date: Date) {
  return prisma.attendance.findMany({ where: { batchId, date }, include: { student: true } });
}

async function findUnnotifiedAbsences(date: Date) {
  return prisma.attendance.findMany({
    where: { date, status: 'ABSENT', notifiedAt: null },
    include: { student: true },
  });
}

async function markNotified(id: string) {
  return prisma.attendance.update({ where: { id }, data: { notifiedAt: new Date() } });
}

/** Consecutive-absence count for churn-signal detection (Black Belt phase groundwork). */
async function countRecentConsecutiveAbsences(studentId: string, lookback = 5): Promise<number> {
  const recent: Attendance[] = await prisma.attendance.findMany({
    where: { studentId },
    orderBy: { date: 'desc' },
    take: lookback,
  });
  let streak = 0;
  for (const record of recent) {
    if (record.status === 'ABSENT') streak += 1;
    else break;
  }
  return streak;
}

async function weeklySummaryForBatch(batchId: string, from: Date, to: Date) {
  return prisma.attendance.groupBy({
    by: ['studentId', 'status'],
    where: { batchId, date: { gte: from, lte: to } },
    _count: true,
  });
}

export const attendanceRepository = {
  mark,
  findForDate,
  findUnnotifiedAbsences,
  markNotified,
  countRecentConsecutiveAbsences,
  weeklySummaryForBatch,
};
