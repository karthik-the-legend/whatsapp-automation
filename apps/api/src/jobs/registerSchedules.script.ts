// apps/api/src/jobs/registerSchedules.script.ts
import { registerSchedules } from './scheduler';

registerSchedules()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to register schedules', err);
    process.exit(1);
  });
