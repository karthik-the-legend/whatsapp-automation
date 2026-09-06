# Academy Knowledge System - how to add/update information

This explains how Neha (the WhatsApp chatbot) knows what she knows about
KOMBAT Fitness Academy, and how to update that information safely. There is
no live admin UI for this yet - updates are made by editing files directly
and redeploying.

## Where facts live, and why there are two places

**1. Structured data (exact, single-answer facts) - `businessQuery.service.ts` + the database**

Schedules, branch names/locations, fees, the founder's name, the admission
process, the free demo, and age eligibility are answered *before the AI ever
runs*, from:

- **`apps/api/prisma/seed.ts`** - real `Batch` rows (branch, category,
  days, times, and `feeAmount` in paise). This is the only source of truth
  for "what days does X run" and "what time".
- **`apps/api/src/services/businessQuery.service.ts`** - the `FEE_PROFILES`
  constant (exact fee breakdowns: monthly, registration, uniform, first
  month total) and small quick-fact handlers (founder, admission process,
  demo, age eligibility).

If a customer's question has exactly one correct answer, it belongs here,
not in a knowledge document - that keeps the chatbot's arithmetic and
branch/day lookups from ever drifting into a free-text description that
could go stale or be phrased inconsistently.

**2. Knowledge documents (explanatory/narrative content) - `apps/api/knowledge/`**

Founder biography, program descriptions, branch profiles, and the
admission process explained in full sentences live as markdown files with
YAML-style frontmatter under `apps/api/knowledge/`:

```
knowledge/
  academy/    academy_profile.md, founder_profile.md, programs.md
  branches/   main_branch_begur_koppa.md, adon_institute_hosa_road.md
  admission/  admission_process.md, demo_session.md
  fees/       main_branch_junior_fees.md, main_branch_senior_fees.md, adon_institute_junior_fees.md
```

These are retrieved by `apps/api/src/services/knowledgeBase.service.ts` -
a lightweight keyword+metadata matcher (not vector embeddings; at this
document count, embeddings would be new infrastructure for no real
retrieval-quality gain) - and injected into the AI's system prompt only
when a document's category matches something in the customer's message.
The AI never sees the whole knowledge base at once.

**Rule of thumb:** if the answer is a number, a day, a time, or "yes/no
with a hard limit", it belongs in structured data. If it's a paragraph of
explanation, it belongs in a knowledge document. The fee documents
straddle both - see below.

## How to update a schedule

Edit the `batches` array in `apps/api/prisma/seed.ts`, then run:

```bash
npm run db:seed
```

This re-runs against whatever `DATABASE_URL` is currently configured
(local or production) - point it at the right database first. Batches are
upserted by `(name, branch)`, and any batch no longer in the array is
removed *unless* a real student is still linked to it (the script logs
which case happened).

## How to update a fee

Fees are intentionally duplicated in two places that must be kept in sync:

1. `apps/api/src/services/businessQuery.service.ts` - the `FEE_PROFILES`
   constant (this is what the chatbot actually calculates from).
2. The matching file under `apps/api/knowledge/fees/` - the human-readable
   explanation, so anyone reading the knowledge base alone still sees the
   correct number. Each fee document has a maintainer note pointing back at
   its `FEE_PROFILES` key.

Also update `feeAmount` on the relevant batches in `seed.ts` (the monthly
amount only, in paise) and re-run `npm run db:seed`.

## How to add a new verified fact

1. Never write a document (or a `FEE_PROFILES`/handler entry) for
   something that hasn't actually been confirmed - an empty knowledge base
   on a topic is correct if the fact isn't verified yet; the chatbot's
   fallback ("I don't have the verified information for that right now...")
   is the intended behavior, not a bug to "fix" by inventing content.
2. Decide structured vs. narrative using the rule of thumb above.
3. For a knowledge document: create the `.md` file in the right
   subdirectory with frontmatter (`academy`, `branch`, `category`,
   `audience`, `status`, `source`, `version`) and only the verified body
   text. Add its category to `CATEGORY_TRIGGERS` in
   `knowledgeBase.service.ts` if it's a new category, with a few realistic
   trigger phrases.
4. For a structured fact: add a constant/handler to
   `businessQuery.service.ts`, following the existing handlers
   (`answerFounderQuestion`, `answerAdmissionProcessQuestion`, etc.) as a
   template - each returns `null` when it doesn't apply, so order in the
   `HANDLERS` array only matters for genuinely overlapping keywords.
5. Add a test case to `apps/api/scripts/testBusinessQueries.ts` (structured
   facts) covering the new question, and run:

   ```bash
   npm run test:business-queries
   ```

## How to retire/deprecate a document

Set `status: "inactive"` in its frontmatter rather than deleting it -
`knowledgeBaseService.loadAll()` filters to `status: active` (the default
when the field is omitted), so an inactive document is invisible to
retrieval but stays in git history for reference.

## What never goes in the knowledge base

- Anything about a specific customer (their name, their child's age, which
  branch they prefer) - that belongs in `CustomerProfile`
  (`studentAge`/`preferredBranch`/`interestedProgram`), which is
  per-customer and private, never mixed into the shared academy knowledge
  base.
- Anything not actually verified - discounts, holidays, refund/cancellation
  policies, required documents, payment methods, or credentials/
  certifications beyond what's explicitly confirmed. Adding a document "to
  fill in the gap" defeats the entire point of this system, which is to
  make the chatbot say "I don't know" honestly rather than guess.
