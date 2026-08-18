// apps/api/src/plugins/clerkAuth.plugin.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Covers spec item #14. Verifies the Clerk session token on every request
// (network JWKS lookup against Clerk, cached by the SDK), then maps the
// verified Clerk user to our own AdminUser row - Clerk proves identity,
// AdminUser decides authorization (see adminAuth.service.ts for why those
// are kept separate).
//
// Deliberately NOT wrapped in fastify-plugin's fp() - unlike
// security.plugin.ts/errorHandler.plugin.ts which must apply globally
// before any route is registered, this one is registered inside a nested
// encapsulation context in routes/index.ts so it only ever guards
// /api/v1/* and never the signature-authenticated webhook routes.

import { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyToken } from '@clerk/backend';
import { AdminRole } from '@academy/db';
import { ApiError } from './errorHandler.plugin';
import { adminAuthService } from '../services/adminAuth.service';
import { env } from '../config/env';
import { logger } from '../config/logger';

const log = logger.child({ module: 'clerk-auth-plugin' });

declare module 'fastify' {
  interface FastifyRequest {
    adminUser?: { id: string; clerkId: string; name: string; email: string; role: AdminRole };
  }
}

export async function clerkAuthPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Missing Authorization bearer token');
    }
    const token = header.slice('Bearer '.length);

    let claims;
    try {
      claims = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    } catch (err: any) {
      log.warn('Clerk token verification failed', { error: err.message });
      throw new ApiError(401, 'Invalid or expired session token');
    }

    const adminUser = await adminAuthService.findByClerkId(claims.sub);
    if (!adminUser) {
      throw new ApiError(403, 'This Clerk account is not registered as an academy admin');
    }

    request.adminUser = adminUser;
  });
}
