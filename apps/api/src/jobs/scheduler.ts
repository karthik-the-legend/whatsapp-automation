// apps/api/src/jobs/scheduler.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Registers every recurring automation as a BullMQ repeatable job. This is
// the ONE place schedules are defined - services themselves (reminder,
// communication, attendance) stay schedule-agnostic and testable in
// isolation. Run via `npm run jobs:schedule` once at deploy time (BullMQ
// persists repeatable job definitions in Redis, so this doesn't need to
// run continuously - the worker process below does).

import { Queue, Worker } from 'bullmq';
import { bullmqConnection, QUEUE_PREFIX } from '../config/redis';
import { reminderService } from '../services/reminder.service';
import { attendanceService } from '../services/attendance.service';
import { communicationService } from '../services/communication.service';
import { logger } from '../config/logger';

const log = logger.child({ module: 'job-scheduler' });

const AUTOMATION_QUEUE = `${QUEUE_PREFIX}:automations`;

type AutomationJobName =
  | 'class-reminders'
  | 'fee-reminders'
  | 'overdue-nudges'
  | 'notify-absentees'
  | 'birthday-wishes';

const automationQueue = new Queue<{}, void, AutomationJobName>(AUTOMATION_QUEUE, {
  connection: bullmqConnection,
});

/** Call once at deploy time to (re)register all repeatable schedules. */
export async function registerSchedules(): Promise<void> {
  // Class reminders: checked every 5 minutes; each Batch's own
  // reminderOffsetMins decides whether "now" is actually a send moment.
  await automationQueue.add('class-reminders', {}, { repeat: { pattern: '*/5 * * * *' } });

  // Fee reminders + overdue sweep: once daily, early morning.
  await automationQueue.add('fee-reminders', {}, { repeat: { pattern: '0 8 * * *' } });
  await automationQueue.add('overdue-nudges', {}, { repeat: { pattern: '30 8 * * *' } });

  // Absence notifications: once daily, evening (after the day's classes end).
  await automationQueue.add('notify-absentees', {}, { repeat: { pattern: '0 20 * * *' } });

  // Birthday wishes: once daily, morning.
  await automationQueue.add('birthday-wishes', {}, { repeat: { pattern: '0 9 * * *' } });

  log.info('Automation schedules registered');
}

/** Worker process entry point (run via `npm run jobs:worker`). */
export function startAutomationWorker(): Worker<{}, void, AutomationJobName> {
  return new Worker<{}, void, AutomationJobName>(
    AUTOMATION_QUEUE,
    async (job) => {
      log.info('Running automation job', { name: job.name });
      switch (job.name) {
        case 'class-reminders':
          return reminderService.sendDueClassReminders();
        case 'fee-reminders':
          return reminderService.sendDueFeeReminders();
        case 'overdue-nudges':
          return reminderService.sendOverdueNudges();
        case 'notify-absentees':
          return attendanceService.notifyAbsentees();
        case 'birthday-wishes':
          await communicationService.sendBirthdayWishes();
          return;
        default:
          log.warn('Unknown automation job', { name: job.name });
      }
    },
    { connection: bullmqConnection },
  );
}
