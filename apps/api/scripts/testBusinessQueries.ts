// apps/api/scripts/testBusinessQueries.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Automated regression coverage for businessQuery.service.ts - the
// deterministic layer that answers schedule/branch/fee/KOMBAT EXERCISE
// questions from real KOMBAT Fitness Academy data before the AI ever
// runs. No test framework is installed in this project, so this is a
// plain assert-and-exit-nonzero-on-failure script, run directly with tsx.
//
// Usage: npm run test:business-queries

import '../src/config/env';
import { businessQueryService } from '../src/services/businessQuery.service';
import { prisma } from '@academy/db';

interface Case {
  label: string;
  question: string;
  /** Every one of these substrings must appear in the answer text (case-insensitive). */
  mustInclude: string[];
  /** None of these may appear - guards against inventing facts or conflating branches/disciplines. */
  mustNotInclude?: string[];
}

const cases: Case[] = [
  // --- Schedule: Branch 1 Kung Fu ---
  { label: 'Monday Kung Fu classes (Branch 1)', question: 'Are there Kung Fu classes on Monday?', mustInclude: ['5 PM', '6 PM'] },
  { label: 'Kung Fu timings - all 6 batches', question: 'What are the Kung Fu timings?', mustInclude: ['5 PM', '9:30 AM', '4 PM', '6 PM', '10:30 AM', '2 PM'] },
  { label: 'Weekend Kung Fu batches', question: 'What Kung Fu batches are on the weekend?', mustInclude: ['9:30 AM', '4 PM', '10:30 AM', '2 PM'], mustNotInclude: ['5 PM–6 PM'] },
  { label: 'Batch 3 exact time', question: 'What time is Kung Fu batch 3?', mustInclude: ['4 PM', '5 PM'] },
  { label: 'Is Batch 3 available Monday - must correct, not invent', question: 'Is Kung Fu Batch 3 available on Monday?', mustInclude: ['Saturday', 'Sunday'], mustNotInclude: ['Yes, Monday'] },
  { label: 'Sunday at 4 (bare hour, no am/pm)', question: 'Is there a Kung Fu class Sunday at 4?', mustInclude: ['4 PM'] },

  // --- Schedule: Senior batches ---
  { label: 'Senior batch timings', question: 'What are the senior batch timings?', mustInclude: ['6:30 AM', '7 PM'], mustNotInclude: ['9:30 AM'] },
  { label: 'Senior batch audience not invented as age number', question: 'Who are the senior classes for?', mustInclude: ['6:30 AM'] },

  // --- BRANCH RULE: Hosa Road must never be conflated with Branch 1 ---
  { label: 'Hosa Road Kung Fu - only that branch\'s batch', question: 'Do you have Kung Fu at Hosa Road?', mustInclude: ['5:30 PM', '6:30 PM'], mustNotInclude: ['5 PM–6 PM', '9:30 AM'] },
  { label: 'Generic Kung Fu question does not silently merge branches into one list', question: 'What are the Kung Fu timings?', mustInclude: ['Branch 1'] },

  // --- Dance ---
  { label: 'Dance classes for children', question: 'Do you have dance classes for kids?', mustInclude: ['5 PM', '6 PM'], mustNotInclude: ['Adults'] },
  { label: 'Dance classes for adults', question: 'Do you have dance classes for adults?', mustInclude: ['6 PM', '7 PM'] },
  { label: 'Dance classes unspecified audience shows both', question: 'What dance classes do you have?', mustInclude: ['Children', 'Adults'] },

  // --- KOMBAT EXERCISE ---
  // "AM"/"PM" as bare substrings falsely match inside ordinary words like
  // "team" or "exam" - check for an actual clock-time pattern instead.
  { label: 'KOMBAT EXERCISE basics, no invented timing/fee', question: 'Tell me about KOMBAT EXERCISE', mustInclude: ['55-minute', 'virtual'], mustNotInclude: ['₹'] },

  // --- Fees: must NEVER give a number, ever ---
  { label: 'Fee question gives no invented number', question: 'What are your fees?', mustInclude: ["don't have"], mustNotInclude: ['₹', '1,500', '4,500', '2,000', '3,500'] },
  { label: 'Kids fee question still gives no number', question: 'What is the monthly fee for kids?', mustInclude: ["don't have"], mustNotInclude: ['₹'] },
  { label: 'Uniform fee question gives no number (old placeholder ₹800/₹1,500 must not reappear)', question: 'How much is the uniform?', mustInclude: ["don't have"], mustNotInclude: ['₹', '800', '1,500'] },

  // --- Unconfirmed disciplines: must not be presented as available ---
  { label: 'Boxing not falsely presented as an active batch', question: 'Do you have boxing classes?', mustInclude: ["don't have", 'Kung Fu'], mustNotInclude: ['5 PM–6 PM', 'Yes, boxing'] },
  { label: 'MMA not falsely presented as an active batch', question: 'Is there an MMA class?', mustInclude: ["don't have"] },

  // --- Things that are deliberately NO LONGER handled deterministically (guards against stale content resurfacing) ---
  { label: 'JKD is no longer part of this academy\'s deterministic data', question: 'What is JKD?', mustInclude: [] }, // handled below as a null-result check
];

async function main() {
  let pass = 0;
  let fail = 0;

  for (const c of cases) {
    const result = await businessQueryService.answer(c.question);
    const text = result?.text ?? '';
    const lower = text.toLowerCase();

    if (c.label.includes('no longer part of this academy')) {
      // This one specifically asserts NO deterministic match anymore - JKD
      // isn't this academy's discipline per the corrected knowledge base.
      if (result === null) {
        console.log(`PASS  ${c.label} (correctly falls through to AI/FAQ, not a stale deterministic answer)`);
        pass += 1;
      } else {
        console.log(`FAIL  ${c.label}\n      Got a deterministic answer when there should be none: "${text}"`);
        fail += 1;
      }
      continue;
    }

    const missing = c.mustInclude.filter((s) => !lower.includes(s.toLowerCase()));
    const forbidden = (c.mustNotInclude ?? []).filter((s) => lower.includes(s.toLowerCase()));

    if (c.label.startsWith('KOMBAT EXERCISE') && /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(text)) {
      console.log(`FAIL  ${c.label}\n      Invented a clock time that was never given: "${text}"`);
      fail += 1;
      continue;
    }

    if (!result) {
      console.log(`FAIL  ${c.label}\n      Q: "${c.question}"\n      Got no deterministic answer at all`);
      fail += 1;
      continue;
    }
    if (missing.length || forbidden.length) {
      console.log(`FAIL  ${c.label}`);
      console.log(`      Q: "${c.question}"`);
      console.log(`      A: "${text}"`);
      if (missing.length) console.log(`      missing: ${missing.join(', ')}`);
      if (forbidden.length) console.log(`      contains forbidden text: ${forbidden.join(', ')}`);
      fail += 1;
      continue;
    }
    console.log(`PASS  ${c.label}`);
    pass += 1;
  }

  console.log(`\n${pass}/${cases.length} passed`);
  if (fail > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
