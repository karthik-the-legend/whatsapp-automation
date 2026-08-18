// apps/api/src/plugins/rawBody.plugin.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Fastify parses JSON bodies by default and discards the raw bytes. But
// Meta's X-Hub-Signature-256 header is an HMAC computed over the exact raw
// request body they sent - if we verify against JSON.stringify(parsedBody)
// instead, even a harmless whitespace difference from re-serialization
// would make every signature check fail.
//
// This plugin replaces Fastify's default JSON parser with one that keeps
// the raw Buffer (on request.rawBody) AND still parses it to JSON as
// normal, so every other route keeps using request.body like usual.
// Only the webhook route reads request.rawBody.

import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

async function rawBodyPluginImpl(fastify: FastifyInstance): Promise<void> {
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req: FastifyRequest, body: Buffer, done) => {
      req.rawBody = body;
      if (body.length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(body.toString('utf8')));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );
}

export const rawBodyPlugin = fp(rawBodyPluginImpl, { name: 'raw-body-plugin' });
