// apps/api/src/services/communication.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Covers spec item #4 (Student Communication Automation). These are
// distinct from broadcast.service.ts in shape: some are individual,
// triggered-by-event sends (welcome message, birthday wish) rather than
// admin-initiated mass broadcasts to a segment. Messages are customizable
// via the `template` object each function takes, per the spec.

import { studentRepository } from '../repositories/student.repository';
import { broadcastService } from './broadcast.service';
import { whatsappService } from './whatsapp.service';
import { env } from '../config/env';
import { logger } from '../config/logger';

const log = logger.child({ module: 'communication-service' });

// --- Individual, event-triggered messages -----------------------------------

/** Sent once, immediately after a student's first record is created. */
async function sendWelcomeMessage(studentId: string, customMessage?: string): Promise<void> {
  const student = await studentRepository.findById(studentId);
  if (!student) return;

  const message =
    customMessage ??
    `Welcome to ${env.ACADEMY_NAME}, ${student.name}! 🥋 We're excited to have you on the mat. ` +
      `You can message us here anytime for timings, fees, or any questions - and we'll always have a human ready if you need one.`;

  await whatsappService.sendText(student.phone, message);
  log.info('Welcome message sent', { studentId });
}

/** Runs daily via BullMQ - finds students whose birthday is today and wishes them. */
async function sendBirthdayWishes(today: Date = new Date()): Promise<number> {
  const students = await studentRepository.findBirthdaysOn(today.getMonth() + 1, today.getDate());

  for (const student of students) {
    const message = `Happy Birthday, ${student.name.split(' ')[0]}! 🎉 Wishing you a fantastic year ahead, from everyone at ${env.ACADEMY_NAME}!`;
    await whatsappService.sendText(student.phone, message);
  }

  log.info('Birthday wishes sent', { count: students.length });
  return students.length;
}

// --- Segment broadcasts (thin wrappers over broadcastService for common cases) --

async function announceHoliday(dateLabel: string, reason: string, templateName = 'holiday_notice'): Promise<void> {
  await broadcastService.send({
    segment: 'ALL_STUDENTS',
    templateName,
    bodyPreview: `Holiday notice: no classes on ${dateLabel} (${reason}).`,
    components: [{ type: 'body', parameters: [{ type: 'text', text: dateLabel }, { type: 'text', text: reason }] }],
  });
}

async function announceClassCancellation(batchId: string, dateLabel: string, reason: string, templateName = 'class_cancelled'): Promise<void> {
  await broadcastService.send({
    segment: 'SPECIFIC_BATCH',
    segmentFilter: { batchId },
    templateName,
    bodyPreview: `Class cancelled on ${dateLabel}: ${reason}.`,
    components: [{ type: 'body', parameters: [{ type: 'text', text: dateLabel }, { type: 'text', text: reason }] }],
  });
}

async function announceScheduleChange(batchId: string, newDetails: string, templateName = 'schedule_change'): Promise<void> {
  await broadcastService.send({
    segment: 'SPECIFIC_BATCH',
    segmentFilter: { batchId },
    templateName,
    bodyPreview: `Schedule update: ${newDetails}`,
    components: [{ type: 'body', parameters: [{ type: 'text', text: newDetails }] }],
  });
}

async function announceTournament(details: string, templateName = 'tournament_announcement', segment: 'ALL_STUDENTS' | 'BELT_LEVEL' = 'ALL_STUDENTS', beltLevel?: string): Promise<void> {
  await broadcastService.send({
    segment,
    segmentFilter: beltLevel ? { beltLevel } : undefined,
    templateName,
    bodyPreview: `Tournament announcement: ${details}`,
    components: [{ type: 'body', parameters: [{ type: 'text', text: details }] }],
  });
}

async function announceBeltExam(batchId: string, examDate: string, templateName = 'belt_exam_announcement'): Promise<void> {
  await broadcastService.send({
    segment: 'SPECIFIC_BATCH',
    segmentFilter: { batchId },
    templateName,
    bodyPreview: `Belt exam scheduled for ${examDate}.`,
    components: [{ type: 'body', parameters: [{ type: 'text', text: examDate }] }],
  });
}

/** Runs monthly via BullMQ. */
async function sendMonthlyMotivation(templateName = 'monthly_motivation', message?: string): Promise<void> {
  await broadcastService.send({
    segment: 'ACTIVE_STUDENTS',
    templateName,
    bodyPreview: message ?? 'Monthly motivational message',
    components: message ? [{ type: 'body', parameters: [{ type: 'text', text: message }] }] : [],
  });
}

async function announceEvent(details: string, templateName = 'event_invitation'): Promise<void> {
  await broadcastService.send({
    segment: 'ALL_STUDENTS',
    templateName,
    bodyPreview: `Event invitation: ${details}`,
    components: [{ type: 'body', parameters: [{ type: 'text', text: details }] }],
  });
}

export const communicationService = {
  sendWelcomeMessage,
  sendBirthdayWishes,
  announceHoliday,
  announceClassCancellation,
  announceScheduleChange,
  announceTournament,
  announceBeltExam,
  sendMonthlyMotivation,
  announceEvent,
};
