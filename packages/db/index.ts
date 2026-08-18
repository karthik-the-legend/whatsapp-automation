// packages/db/index.ts
//
// Single Prisma client instance, shared by apps/api (and later apps/web for
// server-component reads). Never instantiate `new PrismaClient()` anywhere
// else - in dev, Next.js/ts-node hot-reload can otherwise spawn a new client
// per reload and exhaust Postgres connections.

import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export * from '@prisma/client';
