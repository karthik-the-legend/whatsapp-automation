# Services Layer — Setup & Verification Notes

## What's implemented

The full `apps/api/src/services` layer for the automation spec, plus the
repositories, Prisma schema, AI provider abstraction, webhook orchestration,
and BullMQ job scheduling it depends on. See the table in the chat response
for which file covers which spec requirement.

## Verified in this build

- `npm install` succeeds across the workspace (root + `apps/api` + `packages/db`).
- `npx tsc --noEmit` in `apps/api` produces **zero** errors outside of
  `Module "@academy/db" has no exported member 'X'`.
- Every one of those remaining errors was cross-checked against
  `prisma/schema.prisma`: each model/enum name (`Student`, `Batch`, `Faq`,
  `AttendanceStatus`, etc.) is spelled and referenced consistently between
  the schema and every repository/service that imports it. There are no
  naming mismatches - the errors exist solely because the Prisma client
  hasn't been generated yet in this build environment.

## Why Prisma client generation didn't run here

`npx prisma generate` needs to download a query-engine binary from
`binaries.prisma.sh`. This sandbox's network is restricted to a fixed
allowlist (npm/GitHub/PyPI domains) that doesn't include Prisma's binary
host, so the download step fails with a 403. This is a sandbox restriction,
not a problem with your machine - Prisma's own registry package installs
fine (`npm install` above succeeded), only the post-install binary fetch is
blocked here.

## To finish setup on your machine

```bash
cd academy-automation
npm install

cp .env.example apps/api/.env   # not included yet - see below
# fill in DATABASE_URL at minimum, e.g.:
# DATABASE_URL=postgresql://academy:academy_dev_password@localhost:5432/academy_automation

docker compose -f infra/docker-compose.yml up -d   # local Postgres + Redis

npm run db:generate     # generates the Prisma client - works fine with real internet access
npm run db:migrate      # creates the tables from schema.prisma

npm run typecheck       # should now be 100% clean
npm run dev:api         # starts the Fastify API
```

Note: `apps/api/.env.example` isn't included in this drop - the env vars
referenced by `src/config/env.ts` are: `DATABASE_URL`, `REDIS_URL`,
`WHATSAPP_API_VERSION`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `AI_PROVIDER`,
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CLERK_SECRET_KEY`, `ACADEMY_NAME`,
`ACADEMY_CONTACT_PHONE`, `ACADEMY_TIMEZONE`.

## What's intentionally NOT built yet

- The Fastify route + HMAC signature verification that receives Meta's
  webhook POST and calls `whatsappWebhookHandler.handleInboundMessage()` -
  `webhooks/whatsapp.webhook.ts` is the orchestration logic, but the actual
  `fastify.post('/webhooks/whatsapp', ...)` route with raw-body signature
  checking isn't wired up yet.
- The Razorpay/Stripe payment webhook that calls `receiptService.issueAndSendReceipt()`.
- Joi/Zod request validators for the future admin API routes.
- The admin dashboard itself (`apps/web` - Brown Belt phase, per the roadmap).
- Seed data / sample FAQs for the chatbot to actually answer with on first run.

These are the natural next slice if you want to keep going.
