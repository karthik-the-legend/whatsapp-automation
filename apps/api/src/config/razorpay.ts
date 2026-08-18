// apps/api/src/config/razorpay.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Lazily creates a Razorpay SDK client only if real credentials are
// configured. Returns null when they're not (local dev, before you have
// a real Razorpay account) so payment.service.ts can fall back to a mock
// order id for local testing instead of crashing on missing credentials.

import Razorpay from 'razorpay';
import { env } from './env';

let client: Razorpay | null | undefined;

export function getRazorpayClient(): Razorpay | null {
  if (client !== undefined) return client;

  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    client = null;
    return client;
  }

  client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return client;
}
