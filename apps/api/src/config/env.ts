// apps/api/src/config/env.ts
//
// Same rationale as any env.ts: validate once at boot, fail fast, export a
// typed object. Nothing else in the app reads process.env directly.

import { z } from 'zod';
import 'dotenv/config';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  WHATSAPP_API_VERSION: z.string().default('v20.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
  WHATSAPP_ACCESS_TOKEN: z.string().default(''),
  WHATSAPP_APP_SECRET: z.string().default(''),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().default(''),

  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),

  AI_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  ANTHROPIC_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),

  CLERK_SECRET_KEY: z.string().default(''),

  ACADEMY_NAME: z.string().default('Kombat Fitness Academy'),
  ACADEMY_CONTACT_PHONE: z.string().default(''),
  ACADEMY_TIMEZONE: z.string().default('Asia/Kolkata'),
});

console.log(
    "RAW TOKEN:",
    JSON.stringify(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)
);
const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
