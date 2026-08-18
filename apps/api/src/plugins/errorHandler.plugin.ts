// apps/api/src/plugins/errorHandler.plugin.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Every route should just `throw` a typed error (see ApiError below) and
// never format its own error response. This is the single place that
// turns any thrown error into a consistent JSON shape and logs it.

import fp from 'fastify-plugin';
import { FastifyInstance, FastifyError } from 'fastify';
import { logger } from '../config/logger';
import { env } from '../config/env';

const log = logger.child({ module: 'error-handler' });

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function errorHandlerPluginImpl(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((err: FastifyError | ApiError, request, reply) => {
    const statusCode = 'statusCode' in err && err.statusCode ? err.statusCode : 500;
    const isOperational = err instanceof ApiError;

    if (isOperational) {
      log.warn('Operational error', { path: request.url, error: err.message, statusCode });
    } else {
      log.error('Unhandled error', { path: request.url, error: err.message, stack: err.stack });
    }

    reply.status(statusCode).send({
      success: false,
      message: isOperational ? err.message : 'Internal server error',
      ...(isOperational && (err as ApiError).details ? { details: (err as ApiError).details } : {}),
      ...(env.NODE_ENV === 'production' ? {} : { stack: err.stack }),
    });
  });

  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      message: `Route not found: ${request.method} ${request.url}`,
    });
  });
}

export const errorHandlerPlugin = fp(errorHandlerPluginImpl, { name: 'error-handler-plugin' });
