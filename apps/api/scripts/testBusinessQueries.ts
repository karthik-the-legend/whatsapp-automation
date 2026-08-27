// apps/api/scripts/testBusinessQueries.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Automated regression coverage for businessQuery.service.ts - the
// deterministic layer that answers schedule/fee/belt/personal-training/JKD
// quick-fact questions from real KFA data before the AI ever runs. No test
// framework is installed in this project, so this is a plain assert-and-
// exit-nonzero-on-failure script, run directly with tsx - same philosophy
// as the rest of scripts/ (real code path, no mocking).
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
  /** None of these may appear - guards against inventing facts (e.g. a wrong day/amount). */
  mustNotInclude?: string[];
}

const cases: Case[] = [
  { label: 'TEST 7: Monday classes', question: 'Are there classes on Monday?', mustInclude: ['5 PM', '6 PM', '6:30 AM', '7 PM'] },
  { label: 'TEST 8: junior timings (all 6 batches)', question: 'What are the junior timings?', mustInclude: ['5 PM', '9:30 AM', '4 PM', '6 PM', '10:30 AM', '2 PM'] },
  { label: 'TEST 9: adult timings (both batches)', question: 'What are the adult timings?', mustInclude: ['6:30 AM', '7 PM'], mustNotInclude: ['9:30 AM'] },
  { label: 'TEST 10: kids monthly fee', question: 'What is the kids monthly fee?', mustInclude: ['1,500'], mustNotInclude: ['4,500', '2,000'] },
  { label: 'TEST 11: initial payment for child', question: 'How much do I pay initially for my child?', mustInclude: ['4,500'] },
  { label: 'TEST 12: why 4500 (breakdown)', question: 'Why is it 4500?', mustInclude: ['4,500', '1,500 monthly', '1,500 registration', '1,500 for the JKD uniform'] },
  { label: 'TEST 13: adult fee (must not be 3500/month)', question: 'What is adult fee?', mustInclude: ['2,000', '3,500'], mustNotInclude: ['monthly tuition is ₹3,500'] },
  { label: 'TEST 14: junior age', question: 'What age can kids join?', mustInclude: ['4'] },
  { label: 'TEST 15: belt order', question: 'What is the belt order?', mustInclude: ['White', 'Yellow', 'Orange', 'Green', 'Purple', 'Blue', 'Brown', 'Red', 'Black'] },
  { label: 'TEST 16: personal training exists', question: 'Do you have personal training?', mustInclude: ['Tuesday', 'Thursday'] },
  { label: 'TEST 17: personal training must NOT invent a fixed time', question: 'Is personal training at 5 PM?', mustInclude: ['arranged'], mustNotInclude: ['Yes, 5 PM', 'personal training is at 5'] },
  { label: 'TEST 18: batch at 10:30', question: 'Is there a batch at 10:30?', mustInclude: ['10:30 AM'] },
  { label: 'TEST 19: Sunday at 4 (bare hour, no am/pm)', question: 'Is there a class Sunday at 4?', mustInclude: ['4 PM'] },
  { label: 'TEST 20: Batch 3 on Monday must correct, not invent', question: 'Is Batch 3 available Monday?', mustInclude: ['Sunday'], mustNotInclude: ['Monday 4', 'Yes, Monday'] },
  { label: 'JKD meaning', question: 'What is the meaning of Jeet Kune Do?', mustInclude: ['Way of the Intercepting Fist'] },
  { label: 'JKD founder', question: 'Who created Jeet Kune Do?', mustInclude: ['Bruce Lee'] },
  { label: 'JKD year (must not fall to founder answer)', question: 'When was Jeet Kune Do created?', mustInclude: ['1967', 'July 9'] },
  { label: 'What martial art for kids', question: 'What martial art do you teach kids?', mustInclude: ['Jeet Kune Do'] },
  // No weekday batch (Mon/Wed) should appear in a weekend-only answer -
  // Junior Batch 3's own end time is "5 PM" so that substring isn't a safe
  // negative check here (it's real data, not a leak), unlike "6:30 AM"
  // (Adult Batch 1, weekdays only) which genuinely must never appear.
  { label: 'Weekend batches', question: 'What are the weekend batches?', mustInclude: ['9:30 AM', '10:30 AM', '2 PM'], mustNotInclude: ['6:30 AM'] },
  { label: 'Age-based recommendation (no invented batch assignment)', question: 'My child is 6 years old. Which batch?', mustInclude: ['4'], mustNotInclude: ['Batch 1 is best', 'you should join batch'] },
  { label: 'Ambiguous fee question asks for clarification', question: 'What is the monthly fee?', mustInclude: ['junior', 'adult'] },
  { label: 'Uniform fee (must match real ₹1,500, not old placeholder ₹800)', question: 'How much is the JKD uniform?', mustInclude: ['1,500'], mustNotInclude: ['800'] },
  { label: 'Belt exam yes/no (plural "exams" must still match)', question: 'Do you conduct belt exams?', mustInclude: ['grading', 'examinations'] },
];

async function main() {
  let pass = 0;
  let fail = 0;

  for (const c of cases) {
    const result = await businessQueryService.answer(c.question);
    const text = result?.text ?? '';
    const lower = text.toLowerCase();

    const missing = c.mustInclude.filter((s) => !lower.includes(s.toLowerCase()));
    const forbidden = (c.mustNotInclude ?? []).filter((s) => lower.includes(s.toLowerCase()));

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
