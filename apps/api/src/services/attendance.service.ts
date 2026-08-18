// apps/api/src/services/attendance.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Covers spec item #9: mark attendance (by staff, or self-marked via a
// WhatsApp button reply after the class reminder), notify parents on
// absence, and produce summaries/reports for the admin dashboard.

import { attendanceRepository } from '../repositories/attendance.repository';
import { studentRepository } from '../repositories/student.repository';
import { whatsappService } from './whatsapp.service';
import { logger } from '../config/logger';
import { AttendanceStatus } from '@academy/db';

const log = logger.child({ module: 'attendance-service' });

async function mark(studentId: string, batchId: string, date: Date, status: AttendanceStatus, markedBy?: string) {
  return attendanceRepository.mark(studentId, batchId, date, status, markedBy);
}

async function getForDate(batchId: string, date: Date) {
  return attendanceRepository.findForDate(batchId, date);
}

/**
 * Runs shortly after each class ends (via BullMQ job). Sends one caring,
 * non-guilt-tripping message per newly-recorded absence, then marks it
 * notified so it's never sent twice.
 */
async function notifyAbsentees(date: Date = new Date()): Promise<void> {
  const unnotified = await attendanceRepository.findUnnotifiedAbsences(date);

  for (const record of unnotified) {
    const student = (record as any).student;
    const message = `We missed ${student.name.split(' ')[0]} in class today! Hope everything's okay - see you next class! 💪`;
    const result = await whatsappService.sendText(student.phone, message);

    if (result.success) {
      await attendanceRepository.markNotified(record.id);
    } else {
      log.warn('Absence notification failed', { attendanceId: record.id, error: result.error });
    }
  }
}

async function weeklySummary(batchId: string, from: Date, to: Date) {
  return attendanceRepository.weeklySummaryForBatch(batchId, from, to);
}

/**
 * Consecutive-absence churn signal (groundwork for the Black Belt phase's
 * "flag a student who's missed 3+ classes before they quietly quit").
 * Exposed here now so the admin dashboard can surface it even before the
 * full churn-alerting workflow is built.
 */
async function getChurnRiskStudents(studentIds: string[], threshold = 3): Promise<string[]> {
  const atRisk: string[] = [];
  for (const id of studentIds) {
    const streak = await attendanceRepository.countRecentConsecutiveAbsences(id);
    if (streak >= threshold) atRisk.push(id);
  }
  return atRisk;
}

/** Convenience wrapper for the dashboard: resolves a batch's current roster, then delegates to getChurnRiskStudents. */
async function churnRiskForBatch(batchId: string, threshold = 3): Promise<string[]> {
  const students = await studentRepository.findByBatch(batchId);
  const studentIds = students.map((s: { id: string }) => s.id);
  return getChurnRiskStudents(studentIds, threshold);
}

export const attendanceService = {
  mark,
  getForDate,
  notifyAbsentees,
  weeklySummary,
  getChurnRiskStudents,
  churnRiskForBatch,
};
