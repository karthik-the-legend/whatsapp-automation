// apps/api/scripts/triggerJob.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// jobs/scheduler.ts registers all five automations as BullMQ repeatable
// jobs (see registerSchedules), but waiting for a real cron tick - up to
// 24h for the daily ones - isn't practical while building/testing. This
// calls the exact same service function the worker's switch statement
// calls (see startAutomationWorker), directly and synchronously, so you
// can exercise any job's real logic on demand against whatever's in the
// local DB. It intentionally does NOT go through BullMQ/Redis - this is
// for exercising business logic, not the queue itself. To test the real
// queue -> worker path, run `npm run jobs:schedule` once, then
// `npm run jobs:worker` in another terminal and wait for a tick (or
// temporarily shorten a `repeat.pattern` in scheduler.ts).
//
// Usage (from apps/api):
//   npx tsx scripts/triggerJob.ts class-reminders [YYYY-MM-DDTHH:mm]
//   npx tsx scripts/triggerJob.ts fee-reminders
//   npx tsx scripts/triggerJob.ts overdue-nudges
//   npx tsx scripts/triggerJob.ts notify-absentees [YYYY-MM-DD]
//   npx tsx scripts/triggerJob.ts birthday-wishes [YYYY-MM-DD]

import '../src/config/env';
import { reminderService } from '../src/services/reminder.service';
import { attendanceService } from '../src/services/attendance.service';
import { communicationService } from '../src/services/communication.service';
import { prisma } from '@academy/db';

const VALID_JOBS = ['class-reminders', 'fee-reminders', 'overdue-nudges', 'notify-absentees', 'birthday-wishes'] as const;
type JobName = (typeof VALID_JOBS)[number];

const [, , jobArg, dateArg] = process.argv;

function isValidJob(value: string | undefined): value is JobName {
  return !!value && (VALID_JOBS as readonly string[]).includes(value);
}

async function main() {
  if (!isValidJob(jobArg)) {
    console.error(`Usage: npx tsx scripts/triggerJob.ts <${VALID_JOBS.join('|')}> [date]`);
    process.exit(1);
  }

  const date = dateArg ? new Date(dateArg) : new Date();
  console.log(`Running "${jobArg}"...`);

  switch (jobArg) {
    case 'class-reminders':
      await reminderService.sendDueClassReminders(date);
      break;
    case 'fee-reminders':
      await reminderService.sendDueFeeReminders();
      break;
    case 'overdue-nudges':
      await reminderService.sendOverdueNudges();
      break;
    case 'notify-absentees':
      await attendanceService.notifyAbsentees(date);
      break;
    case 'birthday-wishes': {
      const count = await communicationService.sendBirthdayWishes(date);
      console.log(`Sent ${count} birthday wish(es).`);
      break;
    }
  }

  console.log('Done. Run `npm run debug:conversations` or check WhatsApp send logs above.');
}

main()
  .catch((err) => {
    console.error(`Failed to run job "${jobArg}":`, err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
