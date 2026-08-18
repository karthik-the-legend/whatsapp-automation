// apps/api/src/jobs/worker.script.ts
import { startAutomationWorker } from './scheduler';
import { logger } from '../config/logger';

const log = logger.child({ module: 'worker-process' });

const worker = startAutomationWorker();

worker.on('completed', (job) => log.info('Job completed', { name: job.name }));
worker.on('failed', (job, err) => log.error('Job failed', { name: job?.name, error: err.message }));

log.info('Automation worker started');
