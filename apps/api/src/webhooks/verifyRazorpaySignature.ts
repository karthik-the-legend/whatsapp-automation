// apps/api/src/webhooks/verifyRazorpaySignature.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Same purpose as verifySignature.ts (Meta), but Razorpay's scheme is
// slightly different: the signature header carries the raw hex digest
// directly, with NO "sha256=" prefix (unlike Meta's X-Hub-Signature-256).
// Kept as its own file rather than generalizing verifySignature.ts,
// because conflating two different providers' signature formats into one
// "smart" function is exactly the kind of subtle bug that's invisible
// until a payload with the wrong prefix silently passes verification.

import crypto from 'crypto';
import { env } from '../config/env';

export function verifyRazorpaySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;

  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const receivedBuffer = Buffer.from(signatureHeader, 'hex');
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
