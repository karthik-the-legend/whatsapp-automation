// apps/api/src/server.ts
//
// THE ENTRY POINT. This is the file `npm run dev` (tsx watch src/server.ts)
// and `npm start` (node dist/server.js) actually execute.
//
// Responsible for exactly three things:
//   1. Importing config/env.ts (its top-level validation runs on import -
//      an invalid .env crashes the process here, before anything else runs)
//   2. Connecting to Postgres (via a single test query) and building/starting
//      the Fastify app from app.ts
//   3. Graceful shutdown on SIGTERM/SIGINT
//
// app.ts intentionally knows nothing about ports or process signals - see
// the comment there.

import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from '@academy/db';

const log = logger.child({ module: 'server' });

let appInstance: Awaited<ReturnType<typeof buildApp>> | undefined;

async function start(): Promise<void> {
  // Fail fast if Postgres isn't reachable, rather than booting and failing
  // confusingly on the first real request.
  await prisma.$connect();
  log.info('Connected to Postgres');

  appInstance = await buildApp();

  await appInstance.listen({ port: env.PORT, host: '0.0.0.0' });
  log.info(`API listening on port ${env.PORT} [${env.NODE_ENV}]`);
}

async function shutdown(signal: string): Promise<void> {
  log.info(`Received ${signal}, shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    log.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    if (appInstance) await appInstance.close();
    await prisma.$disconnect();
    log.info('Shutdown complete.');
    process.exit(0);
  } catch (err: any) {
    log.error('Error during shutdown', { error: err.message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason: any) => {
  log.error('Unhandled promise rejection', { reason: reason?.message || reason });
});

process.on('uncaughtException', (err: Error) => {
  log.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

start().catch((err: Error) => {
  log.error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
