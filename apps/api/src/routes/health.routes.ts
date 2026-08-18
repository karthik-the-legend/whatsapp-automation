// apps/api/src/routes/health.routes.ts
//
// The first real route in the app - proves the server boots, Postgres is
// reachable, and Redis is reachable. Registered as a Fastify plugin (not
// a raw function) so route.routes.ts files stay consistent as more get
// added in later features.

import { FastifyInstance } from 'fastify';
import { prisma } from '@academy/db';
import Redis from 'ioredis';
import { env } from '../config/env';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_request, reply) => {
    const [dbStatus, redisStatus] = await Promise.all([checkDatabase(), checkRedis()]);

    const healthy = dbStatus === 'connected' && redisStatus === 'connected';

    reply.status(healthy ? 200 : 503).send({
      success: healthy,
      service: env.ACADEMY_NAME,
      environment: env.NODE_ENV,
      uptimeSeconds: Math.floor(process.uptime()),
      dependencies: { database: dbStatus, redis: redisStatus },
      timestamp: new Date().toISOString(),
    });
  });
}

async function checkDatabase(): Promise<'connected' | 'disconnected'> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'connected';
  } catch {
    return 'disconnected';
  }
}

async function checkRedis(): Promise<'connected' | 'disconnected'> {
  const client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await client.connect();
    await client.ping();
    return 'connected';
  } catch {
    return 'disconnected';
  } finally {
    client.disconnect();
  }
}
