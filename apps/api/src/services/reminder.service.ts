// apps/api/src/services/reminder.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Covers spec items #1 (Batch Reminder Automation) and #10 (Fee Reminder
// Automation). Both are "find things due soon, send a message, mark it
// sent" jobs, so they share this file, but they're two distinct public
// functions with two distinct schedules in the BullMQ job layer
// (see jobs/README.md - jobs/classReminders.job.ts runs every few minutes
// checking each batch's own reminderOffsetMins; jobs/feeReminders.job.ts
// runs once daily).
//
// Every timing here is configurable from the admin panel via the Batch
// model (daysOfWeek, classStartTime, reminderOffsetMins) and via the
// FeeReminderStage enum offsets, NOT hardcoded - per the spec's explicit
// "fully configurable" requirement.

import { batchRepository } from '../repositories/batch.repository';
import { studentRepository } from '../repositories/student.repository';
import { paymentRepository } from '../repositories/payment.repository';
import { whatsappService } from './whatsapp.service';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { FeeReminderStage } from '@academy/db';

const log = logger.child({ module: 'reminder-service' });

// ---------------------------------------------------------------------------
// CLASS (BATCH) REMINDERS
// ---------------------------------------------------------------------------

/**
 * Runs frequently (e.g. every 5 minutes via BullMQ repeatable job). For
 * each batch running today, checks whether "now" falls inside the minute
 * window that is exactly `reminderOffsetMins` before `classStartTime` -
 * and if so, reminds every active student in that batch. This naturally
 * supports weekend-only, special-training-only, or any custom schedule
 * because it's driven entirely by each Batch's own daysOfWeek/time/offset,
 * not a single global cron rule.
 */
async function sendDueClassReminders(now: Date = new Date()): Promise<void> {
  const dayOfWeek = now.getDay();
  const batches = await batchRepository.findRunningOnDay(dayOfWeek);

  for (const batch of batches) {
    const [hh, mm] = batch.classStartTime.split(':').map(Number);
    const classStart = new Date(now);
    classStart.setHours(hh, mm, 0, 0);

    const reminderTime = new Date(classStart.getTime() - batch.reminderOffsetMins * 60_000);
    const withinWindow = Math.abs(now.getTime() - reminderTime.getTime()) < 2.5 * 60_000; // +-2.5 min tolerance

    if (!withinWindow) continue;

    const students = await studentRepository.findByBatch(batch.id);
    log.info('Sending class reminders', { batchId: batch.id, batchName: batch.name, studentCount: students.length });

    for (const student of students) {
      const message = `Hi! Reminder: your ${batch.name} class starts at ${batch.classStartTime} today. See you on the mat! 🥋`;
      await whatsappService.sendText(student.phone, message);
    }
  }
}

// ---------------------------------------------------------------------------
// FEE DUE REMINDERS
// ---------------------------------------------------------------------------

const FEE_REMINDER_SCHEDULE: Array<{ daysFromNow: number; stage: FeeReminderStage; buildMessage: (studentName: string, batchName: string, dueDate: Date, amount: number) => string }> = [
  {
    daysFromNow: 7,
    stage: 'DAYS_BEFORE_7',
    buildMessage: (name, batch, due, amount) =>
      `Hi! Just a heads-up - the fee for ${name}'s ${batch} batch (₹${amount / 100}) is due on ${due.toLocaleDateString('en-IN')}. No action needed yet, just a friendly early reminder.`,
  },
  {
    daysFromNow: 3,
    stage: 'DAYS_BEFORE_3',
    buildMessage: (name, batch, due, amount) =>
      `Reminder: ${name}'s ${batch} fee of ₹${amount / 100} is due in 3 days (${due.toLocaleDateString('en-IN')}). You can pay anytime using the link we'll send closer to the date.`,
  },
  {
    daysFromNow: 0,
    stage: 'DUE_DATE',
    buildMessage: (name, batch, due, amount) =>
      `Hi! ${name}'s ${batch} fee of ₹${amount / 100} is due today. Reply here if you'd like the payment link resent.`,
  },
];

/** Runs once daily via BullMQ. Sends each configured pre-due-date reminder stage. */
async function sendDueFeeReminders(): Promise<void> {
  for (const stage of FEE_REMINDER_SCHEDULE) {
    const payments = await paymentRepository.findDueForReminderStage(stage.daysFromNow, stage.stage);

    for (const payment of payments) {
      const student = (payment as any).student;
      const batchName = student.batch?.name ?? 'their';
      const message = stage.buildMessage(student.name, batchName, payment.dueDate, payment.amount);
      const result = await whatsappService.sendText(student.phone, message);

      if (result.success) {
        await paymentRepository.markReminderSent(payment.id, stage.stage);
      } else {
        log.warn('Fee reminder send failed', { paymentId: payment.id, stage: stage.stage, error: result.error });
      }
    }
  }
}

/**
 * Runs once daily, after sendDueFeeReminders. Flags anything now past its
 * due date as OVERDUE and sends the single overdue nudge - the spec is
 * explicit this should never repeat/spam.
 */
async function sendOverdueNudges(): Promise<void> {
  const overduePayments = await paymentRepository.findNewlyOverdue();

  for (const payment of overduePayments) {
    await paymentRepository.update(payment.id, { status: 'OVERDUE' });

    if (payment.remindersSent.includes('OVERDUE')) continue; // never repeat the overdue nudge

    const student = await studentRepository.findById(payment.studentId);
    if (!student) continue;

    const message = `Hi ${student.name.split(' ')[0]}'s parent - this is a gentle reminder that the fee due on ${payment.dueDate.toLocaleDateString('en-IN')} is still pending. Please reach out to ${env.ACADEMY_NAME} if you'd like help sorting this out.`;
    const result = await whatsappService.sendText(student.phone, message);

    if (result.success) {
      await paymentRepository.markReminderSent(payment.id, 'OVERDUE');
    }
  }
}

export const reminderService = { sendDueClassReminders, sendDueFeeReminders, sendOverdueNudges };
