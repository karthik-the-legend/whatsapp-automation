// apps/api/scripts/sendTestPaymentWebhook.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Same idea as sendTestWebhook.ts (Feature 3), but for the Razorpay side:
// builds a payment.captured event in Razorpay's real shape, signs it with
// your (dev-only) RAZORPAY_WEBHOOK_SECRET, and POSTs it to your local
// server - exercising signature check -> payment lookup -> status update
// -> receipt generation -> WhatsApp send attempt, with nothing mocked
// except Razorpay and Meta themselves.
//
// Usage (from apps/api):
//   npx tsx scripts/sendTestPaymentWebhook.ts <gatewayOrderId> [amountPaid=250000] [method=upi]
//
// Get <gatewayOrderId> from the response of POST /api/v1/payments.

import crypto from 'crypto';
import { env } from '../src/config/env';

const [, , orderIdArg, amountArg, methodArg] = process.argv;

if (!orderIdArg) {
  console.error('Usage: npm run test:payment-webhook -- <gatewayOrderId> [amountPaid=250000] [method=upi]');
  console.error('Get gatewayOrderId from the response of POST /api/v1/payments (see README test steps).');
  process.exit(1);
}

const orderId = orderIdArg;
const amount = Number(amountArg ?? 250000);
const method = methodArg ?? 'upi';

const payload = {
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: `pay_test_${Date.now()}`,
        order_id: orderId,
        amount,
        method,
        status: 'captured',
      },
    },
  },
};

async function main() {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    console.error(
      '❌ RAZORPAY_WEBHOOK_SECRET is empty in your .env.\n' +
        '   For local testing, set it to any non-empty string, e.g.:\n' +
        '   RAZORPAY_WEBHOOK_SECRET=dev_test_webhook_secret\n' +
        '   (You\'ll replace this with the real value from Razorpay later.)',
    );
    process.exit(1);
  }

  const rawBody = Buffer.from(JSON.stringify(payload));
  // Note: Razorpay's signature header carries the raw hex digest with NO
  // "sha256=" prefix - unlike Meta's X-Hub-Signature-256. See
  // verifyRazorpaySignature.ts for why this isn't shared logic with the
  // WhatsApp webhook signer.
  const signature = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');

  console.log(`Simulating payment.captured for order ${orderId}: ₹${amount / 100} via ${method}`);

  const response = await fetch(`http://localhost:${env.PORT}/webhooks/razorpay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Razorpay-Signature': signature,
    },
    body: rawBody,
  });

  console.log('Response status:', response.status);
  console.log('Response body:', await response.text());
  console.log(
    '\nCheck the server logs for "Payment marked PAID" and a receipt generation/send attempt,\n' +
      'or fetch GET /api/v1/payments/:id to see the updated status.',
  );
}

main().catch((err) => {
  console.error('Failed to send test payment webhook:', err.message);
  console.error('Is the server running? (npm run dev:api in another terminal)');
  process.exit(1);
});
