// apps/api/scripts/sendTestWebhook.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// You don't have Meta approval yet, so there's no real way to send
// yourself a WhatsApp message that triggers the webhook. This script
// builds a payload in the exact shape Meta sends, signs it with your
// (dev-only) WHATSAPP_APP_SECRET exactly like verifySignature.ts expects,
// and POSTs it to your locally running server - exercising the entire
// real pipeline (signature check -> parse -> handover check -> chatbot ->
// FAQ match -> WhatsApp send attempt) with nothing mocked except Meta
// itself.
//
// Usage (from apps/api):
//   npx tsx scripts/sendTestWebhook.ts "What are your fees?" "+919999999999"

import crypto from 'crypto';
import { env } from '../src/config/env';

const [, , textArg, phoneArg] = process.argv;
const text = textArg ?? 'What are your fees?';
const phone = (phoneArg ?? '+919999999999').replace('+', '');

const payload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'TEST_WABA_ID',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: 'TEST',
              phone_number_id: env.WHATSAPP_PHONE_NUMBER_ID || 'TEST_PHONE_ID',
            },
            messages: [
              {
                id: `wamid.test.${Date.now()}`,
                from: phone,
                timestamp: `${Math.floor(Date.now() / 1000)}`,
                type: 'text',
                text: { body: text },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

async function main() {
  if (!env.WHATSAPP_APP_SECRET) {
    console.error(
      '❌ WHATSAPP_APP_SECRET is empty in your .env.\n' +
        '   For local testing, set it to any non-empty string, e.g.:\n' +
        '   WHATSAPP_APP_SECRET=dev_test_secret_123\n' +
        '   (You\'ll replace this with the real value from Meta later.)',
    );
    process.exit(1);
  }

  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = `sha256=${crypto.createHmac('sha256', env.WHATSAPP_APP_SECRET).update(rawBody).digest('hex')}`;

  console.log(`Sending simulated message from ${phone}: "${text}"`);

  const response = await fetch(`http://localhost:${env.PORT}/webhooks/whatsapp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature,
    },
    body: rawBody,
  });

  console.log('Response status:', response.status);
  console.log('Response body:', await response.text());
  console.log(
    '\nNow run `npm run debug:conversations` to see what the chatbot actually did with it.',
  );
}

main().catch((err) => {
  console.error('Failed to send test webhook:', err.message);
  console.error('Is the server running? (npm run dev:api in another terminal)');
  process.exit(1);
});
