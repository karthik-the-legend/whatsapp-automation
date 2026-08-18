// apps/api/src/app.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Builds and configures the Fastify instance (plugins, routes, error
// handling) but does NOT call listen() or connect to Postgres/Redis.
// That separation is what makes this importable into a test file with
// `fastify.inject()` later, with no real network/socket needed.
// server.ts is the only file that starts the process for real.

import { rawBodyPlugin } from './plugins/rawBody.plugin';
import Fastify, { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { securityPlugin } from './plugins/security.plugin';
import { errorHandlerPlugin } from './plugins/errorHandler.plugin';
import { registerRoutes } from './routes';
import { env } from './config/env';

export async function buildApp(): Promise<FastifyInstance> {
    const fastify = Fastify({
        logger: false,
        trustProxy: true,
    });

    // Register FIRST so the JSON parser captures the raw bytes
    await fastify.register(rawBodyPlugin);

    await fastify.register(securityPlugin);
    await fastify.register(multipart, {
        limits: { fileSize: 20 * 1024 * 1024 }, // 20MB - covers PDFs/scans; WhatsApp's own media cap is higher
    });
    await fastify.register(errorHandlerPlugin);
    await registerRoutes(fastify);

    return fastify;
}

// Re-exported so other modules/tests can reference config without a
// separate import - not strictly necessary, kept small on purpose.
export { env };
