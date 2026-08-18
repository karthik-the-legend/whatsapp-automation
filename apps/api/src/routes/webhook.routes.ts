// apps/api/src/routes/webhook.routes.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// The only file in the app that knows about HTTP-level webhook concerns:
// the GET verification handshake Meta performs once when you configure
// the webhook URL, and the POST that delivers every message/status event
// after that. Both are thin - all real decision-making (handover vs
// chatbot vs status ack) already lives in webhooks/whatsapp.webhook.ts
// and was built in the previous message; this route just gets verified
// payloads to it.

import { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { verifyMetaSignature } from '../webhooks/verifySignature';
import { parseWebhookPayload } from '../webhooks/parsePayload';
import { whatsappWebhookHandler } from '../webhooks/whatsapp.webhook';

const log = logger.child({ module: 'webhook-route' });

interface VerifyQuery {
  'hub.mode'?: string;
  'hub.verify_token'?: string;
  'hub.challenge'?: string;
}

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  // --- GET: one-time verification handshake ---------------------------------
  // Meta calls this when you save the webhook URL in the App Dashboard.
  // Must echo back hub.challenge as plain text if the mode/token match, or
  // Meta refuses to save the webhook configuration at all.
  fastify.get<{ Querystring: VerifyQuery }>('/whatsapp', async (request, reply) => {
    const mode = request.query['hub.mode'];
    const token = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];
    console.log("MODE:", mode);
    console.log("REQUEST TOKEN:", JSON.stringify(token));
    console.log("ENV TOKEN:", JSON.stringify(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN));
    const isValid = mode === 'subscribe' && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    if (isValid && challenge) {
      log.info('Webhook verification handshake succeeded');
      reply.status(200).type('text/plain').send(challenge);
      return;
    }

    log.warn('Webhook verification handshake failed', { mode, tokenProvided: Boolean(token) });
    reply.status(403).send({ success: false, message: 'Verification failed' });
  });

  // --- POST: actual message/status delivery ----------------------------------
  fastify.post('/whatsapp', async (request: FastifyRequest, reply) => {
    const signatureHeader = request.headers['x-hub-signature-256'] as string | undefined;

    if (!request.rawBody || !verifyMetaSignature(request.rawBody, signatureHeader)) {
      log.warn('Webhook signature verification failed - rejecting request');
      reply.status(401).send({ success: false, message: 'Invalid signature' });
      return;
    }

    // Always ack 200 fast once the signature is valid, per Meta's
    // requirements - Meta retries aggressively (and eventually disables
    // the webhook) if it doesn't get a timely 200. Processing errors are
    // logged, never surfaced as a failed HTTP status back to Meta.
    //
    // NOTE: for now this processes messages inline before responding. Once
    // volume grows, swap this for "push to a BullMQ queue, ack immediately,
    // process in workers/" - the queue/ and workers/ folders are reserved
    // for exactly this upgrade.
    reply.status(200).send({ success: true });

    try {
      const { messages, statuses } = parseWebhookPayload(request.body as any);

      for (const message of messages) {
        await whatsappWebhookHandler.handleInboundMessage(message);
      }

      for (const status of statuses) {
        log.info('Delivery status update received', status);
        // Persisting delivery/read status onto the Message record is a
        // small addition for a later feature (message status tracking) -
        // not required for the chatbot to function today.
      }
    } catch (err: any) {
      log.error('Error processing webhook payload', { error: err.message, stack: err.stack });
    }
  });
}
