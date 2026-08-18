// apps/api/src/webhooks/verifySignature.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Meta signs every webhook POST with your app secret and sends the result
// in the X-Hub-Signature-256 header. Verifying it proves the request
// actually came from Meta and wasn't sent by someone who just guessed
// your webhook URL. This is a pure function, deliberately separate from
// the route, so it's trivially unit-testable without spinning up Fastify.

import crypto from 'crypto';
import { env } from '../config/env';

export function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;
  if (!env.WHATSAPP_APP_SECRET) {
    // Explicit, loud failure rather than silently accepting unsigned
    // requests - misconfiguration should never look like "it works."
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', env.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  const received = signatureHeader.replace('sha256=', '');

  // timingSafeEqual requires equal-length buffers, so mismatched lengths
  // must be rejected before calling it (a length check itself doesn't leak
  // anything useful to an attacker).
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
