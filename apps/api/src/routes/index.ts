// apps/api/src/routes/index.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Single place that registers every route plugin with the Fastify
// instance. app.ts imports ONLY this file, never individual route files -
// that way adding a new feature's routes is a one-line addition here,
// not a change to app.ts itself.
//
// As each feature is built, its routes file gets added below. Today:
// only health. Next: webhooks (Feature 2).

import { paymentRoutes } from './payment.routes';
import { studentRoutes } from './student.routes';
import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes';
import { webhookRoutes } from './webhook.routes';
import { razorpayWebhookRoutes } from './razorpayWebhook.routes';
import { batchRoutes } from './batch.routes';
import { attendanceRoutes } from './attendance.routes';
import { broadcastRoutes } from './broadcast.routes';
import { documentRoutes } from './document.routes';
import { analyticsRoutes } from './analytics.routes';
import { clerkAuthPlugin } from '../plugins/clerkAuth.plugin';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(healthRoutes);

  // Webhooks authenticate via provider signature (Meta/Razorpay), never
  // via Clerk - keep them outside the admin-auth encapsulation below.
  await fastify.register(webhookRoutes, { prefix: '/webhooks' });
  await fastify.register(razorpayWebhookRoutes, { prefix: '/webhooks' });

  // Everything under /api/v1 requires a valid Clerk-authenticated admin.
  // Registering clerkAuthPlugin inside this nested context (rather than
  // at the top level) scopes its onRequest hook to just these routes -
  // health and the webhooks above are never touched by it.
  await fastify.register(async (adminApi) => {
    await adminApi.register(clerkAuthPlugin);

    await adminApi.register(batchRoutes, { prefix: '/api/v1/batches' });
    await adminApi.register(studentRoutes, { prefix: '/api/v1/students' });
    await adminApi.register(paymentRoutes, { prefix: '/api/v1/payments' });
    await adminApi.register(attendanceRoutes, { prefix: '/api/v1/attendance' });
    await adminApi.register(broadcastRoutes, { prefix: '/api/v1/broadcasts' });
    await adminApi.register(documentRoutes, { prefix: '/api/v1/documents' });
    await adminApi.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  });
}
