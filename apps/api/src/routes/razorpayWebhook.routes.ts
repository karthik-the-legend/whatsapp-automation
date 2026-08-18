// apps/api/src/routes/razorpayWebhook.routes.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Mirrors webhook.routes.ts's shape (verify -> ack fast -> process async,
// errors logged not thrown) but for Razorpay's event format instead of
// Meta's. Kept as a separate route file rather than merged into
// webhook.routes.ts because they're two unrelated external providers with
// different signature schemes and payload shapes - conflating them would
// make either one harder to reason about in isolation.

import { FastifyInstance, FastifyRequest } from 'fastify';
import { logger } from '../config/logger';
import { verifyRazorpaySignature } from '../webhooks/verifyRazorpaySignature';
import { paymentService } from '../services/payment.service';

const log = logger.child({ module: 'razorpay-webhook-route' });

interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  amount: number;
  method?: string;
  status: string;
}

interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: {
      entity?: RazorpayPaymentEntity;
    };
  };
}

export async function razorpayWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/razorpay', async (request: FastifyRequest, reply) => {
    const signatureHeader = request.headers['x-razorpay-signature'] as string | undefined;

    if (!request.rawBody || !verifyRazorpaySignature(request.rawBody, signatureHeader)) {
      log.warn('Razorpay webhook signature verification failed - rejecting request');
      reply.status(401).send({ success: false, message: 'Invalid signature' });
      return;
    }

    // Ack fast, exactly like the WhatsApp webhook - Razorpay retries
    // aggressively on anything but a prompt 2xx, and retries must be safe
    // (see the idempotency check inside paymentService.handleRazorpayPaymentCaptured).
    reply.status(200).send({ success: true });

    try {
      const body = request.body as RazorpayWebhookPayload;
      const entity = body.payload?.payment?.entity;

      if (body.event === 'payment.captured' && entity) {
        await paymentService.handleRazorpayPaymentCaptured({
          orderId: entity.order_id,
          gatewayPaymentId: entity.id,
          amountPaid: entity.amount,
          method: entity.method,
        });
      } else if (body.event === 'payment.failed' && entity?.order_id) {
        await paymentService.handleRazorpayPaymentFailed(entity.order_id);
      } else {
        log.info('Ignoring unhandled Razorpay event', { event: body.event });
      }
    } catch (err: any) {
      log.error('Error processing Razorpay webhook payload', { error: err.message, stack: err.stack });
    }
  });
}
