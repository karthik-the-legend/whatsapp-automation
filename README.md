# Academy WhatsApp Automation

Monorepo for the "front desk that never sleeps" system — WhatsApp bot,
auto-billing, attendance, and (eventually) the owner dashboard — built
against the stack chosen in `docs/stack-rationale.md`.

## Structure

```
apps/
  web/            # Next.js 15 + TS + Tailwind + shadcn/ui — owner dashboard
                   # (built starting Brown Belt, weeks 18-22)
  api/            # Fastify (Node.js) backend — everything else
    src/
      routes/       # HTTP route -> handler wiring only
      webhooks/     # Meta WhatsApp webhook + Razorpay/Stripe webhook receivers
                     # (HMAC/signature verification lives here)
      services/     # Business logic: enrollment, billing, attendance, reminders
      repositories/ # The only layer allowed to query Prisma/Postgres directly
      jobs/         # BullMQ producers + workers (reminders, invoice generation)
      plugins/      # Fastify plugins: auth (Clerk), db connection, redis connection
      schemas/       # Request/response validation schemas (Fastify uses JSON Schema
                     # natively, or Zod if you prefer)
      utils/         # Pure helper functions (phone formatting, date math)
    prisma/          # schema.prisma - single source of truth for the Postgres schema

packages/
  db/             # Prisma client singleton, shared by api (and later web, for
                   # server components that read directly from Postgres)
  shared-types/   # TypeScript types shared between api and web (Student, Batch,
                   # Payment, etc.) so the dashboard never drifts from the API shape

infra/            # docker-compose for local Postgres+Redis, deployment configs
docs/             # This roadmap, the stack rationale, and any ADRs you write later
```

## Why this shape

- **`apps/api` and `apps/web` are separate deployables** because they scale and
  deploy on different schedules in the real plan: `api` (+ Postgres + Redis +
  workers) goes on Railway/Render from week 1; `web` doesn't even get built
  until Brown Belt (week 18+) and would live on Vercel. No point coupling
  their deploy pipelines now.
- **`packages/db` is separate from `apps/api/src/repositories`** — the Prisma
  client itself (connection, schema) is a shared package because `apps/web`
  will eventually query Postgres directly from Next.js server components for
  the dashboard's fast first-paint. The *repository* layer (query logic) stays
  inside `api` because that's business-specific, not shared.
- **`webhooks/` is split out from `routes/`** on purpose — webhook handlers
  have a fundamentally different contract (raw body needed for signature
  verification, must ack fast and do real work in a queued job, no user
  session) and mixing them into general routes is how signature verification
  bugs happen.
- **`jobs/` exists from day one** even though you won't need BullMQ until
  Orange Belt (billing reminders) — the folder is reserved now so `services/`
  never accidentally grows ad-hoc `setTimeout`-based scheduling that has to be
  ripped out later.

## Build order (maps to the roadmap PDF)

| Rank | Weeks | What you build | Where it lands |
|---|---|---|---|
| White | 1-2 | Meta account, number, BSP, Razorpay — no code | (setup only) |
| Yellow | 3-5 | Webhook receiver, greeting menu, trial booking | `api/src/webhooks`, `api/src/routes`, `api/src/services` |
| Orange | 6-9 | Payment links, receipt PDF, reminder sequence | `api/src/webhooks` (Razorpay), `api/src/jobs`, `api/prisma` |
| Green | 10-13 | Class reminders, attendance capture | `api/src/jobs`, `api/src/routes` |
| Blue | 14-17 | Grading/event broadcasts, referral tracking | `api/src/services`, `api/prisma` |
| Brown | 18-22 | Owner dashboard, role auth, API for it | `apps/web`, `packages/shared-types` |
| Black | 23+ | LLM fallback, churn signal, multi-tenant | `api/src/services`, `packages/db` (tenant scoping) |

Start at White Belt. Don't skip ranks — the doc is right that shipping the
bot + fee reminder first and running it on one real academy for a month
before building the next stripe is what keeps this from becoming vaporware.
