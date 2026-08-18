// apps/api/src/plugins/security.plugin.ts
//
// Registers the security middleware stack. Kept as one plugin so app.ts
// has a single `await fastify.register(securityPlugin)` line instead of
// three separate registrations to remember.

import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

async function securityPluginImpl(fastify: FastifyInstance): Promise<void> {
  await fastify.register(helmet);
  await fastify.register(cors, { origin: true });
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
}

export const securityPlugin = fp(securityPluginImpl, { name: 'security-plugin' });
