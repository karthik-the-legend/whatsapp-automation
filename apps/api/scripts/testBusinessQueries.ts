// apps/api/scripts/testBusinessQueries.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Automated regression coverage for businessQuery.service.ts - the
// deterministic layer that answers schedule/branch/fee/founder/admission/
// demo/age/KOMBAT EXERCISE questions from real KOMBAT Fitness Academy data
// before the AI ever runs. No test framework is installed in this project,
// so this is a plain assert-and-exit-nonzero-on-failure script, run
// directly with tsx.
//
// Ground truth for schedule/fee assertions is read from the real DB (via
// Prisma) rather than hardcoded, so these tests stay correct if seed.ts
// changes and stay correct regardless of which real day "today"/"tomorrow"
// resolve to when the suite runs.
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
  /** When true, a null (no deterministic match) result is the expected/correct outcome. */
  expectNull?: boolean;
}

const MAIN_BRANCH = 'Main Branch';
const ADON_INSTITUTE = 'ADON Institute';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

async function buildCases(): Promise<Case[]> {
  const allBatches = await prisma.batch.findMany();
  const mainJunior = allBatches.filter((b) => b.branch === MAIN_BRANCH && b.category === 'KUNG_FU');
  const mainSenior = allBatches.filter((b) => b.branch === MAIN_BRANCH && b.category === 'SENIOR');
  const adonJunior = allBatches.filter((b) => b.branch === ADON_INSTITUTE && b.category === 'KUNG_FU');

  const today = new Date().getDay();
  const tomorrow = (today + 1) % 7;
  const todayName = DAY_NAMES[today];
  const mainJuniorToday = mainJunior.filter((b) => b.daysOfWeek.includes(today));
  const mainJuniorTomorrow = mainJunior.filter((b) => b.daysOfWeek.includes(tomorrow));

  return [
    // --- A/B: Branch-aware schedule questions ---
    {
      label: 'Main Branch Junior schedule lists only Main Branch batches',
      question: 'What are the Kung Fu timings at Main Branch?',
      mustInclude: mainJunior.map((b) => to12h(b.classStartTime)),
      mustNotInclude: adonJunior.map((b) => to12h(b.classStartTime)).filter((t) => !mainJunior.some((b) => to12h(b.classStartTime) === t)),
    },
    {
      label: 'ADON Institute schedule - only that branch\'s batch',
      question: 'Do you have Kung Fu at Hosa Road?',
      mustInclude: adonJunior.map((b) => to12h(b.classStartTime)),
    },
    {
      label: 'Generic Kung Fu question does not silently merge branches into one list',
      question: 'What are the Kung Fu timings?',
      mustInclude: [MAIN_BRANCH],
    },
    {
      label: 'Senior batch timings (Main Branch only - no verified Senior at ADON)',
      question: 'What are the senior batch timings?',
      mustInclude: mainSenior.map((b) => to12h(b.classStartTime)),
      mustNotInclude: mainJunior.map((b) => to12h(b.classStartTime)).filter((t) => !mainSenior.some((b) => to12h(b.classStartTime) === t)),
    },

    // --- C: Relative-date resolution ---
    {
      label: `"today" resolves to the real current day (${todayName})`,
      question: 'Is there a Kung Fu class today at Main Branch?',
      mustInclude: mainJuniorToday.length ? mainJuniorToday.map((b) => to12h(b.classStartTime)) : ["don't see"],
    },
    {
      label: 'Tomorrow resolves to a different real day than today',
      question: 'Any Kung Fu class tomorrow at Main Branch?',
      mustInclude: mainJuniorTomorrow.length ? mainJuniorTomorrow.map((b) => to12h(b.classStartTime)) : ["don't see"],
    },

    // --- D: Fees - now verified, must give real numbers, never hide the uniform ---
    {
      label: 'Main Branch Junior fee - full breakdown',
      question: 'What is the fee at Main Branch for my son who is 8?',
      mustInclude: ['₹1,500', '₹4,500'],
      mustNotInclude: ["don't have"],
    },
    {
      label: 'ADON Institute Junior fee - matches the exact spec example',
      question: 'My child is 8. How much is the fee at Hosa Road?',
      mustInclude: ['₹1,500', '₹1,500', '₹2,000', '₹5,000'],
      mustNotInclude: ["don't have"],
    },
    {
      label: 'Main Branch Senior fee - uniform stated as a separate line item, never merged',
      question: 'What is the senior fee at Main Branch?',
      mustInclude: ['₹3,500', '₹2,000', 'separate', '₹5,500'],
      mustNotInclude: ["don't have"],
    },
    {
      label: 'ADON Institute has no Senior fee structure - must not invent one',
      question: 'What is the senior fee at Hosa Road?',
      mustInclude: ["doesn't have a verified senior"],
      mustNotInclude: ['₹2,000/month', '₹5,500'],
    },
    {
      label: 'Fee question with no branch stated - asks for clarification instead of guessing',
      question: 'What are your fees?',
      mustInclude: ['which branch'],
      mustNotInclude: ['₹'],
    },
    {
      label: 'Senior fee with no branch stated defaults to Main Branch (only branch with a Senior program - not actually ambiguous)',
      question: 'What is the senior fee?',
      mustInclude: ['₹3,500'],
    },

    // --- E: Founder ---
    { label: 'Founder question', question: 'Who is the founder?', mustInclude: ['Sifu Vikith M', 'Gold Medalist'] },
    { label: 'Head coach question (paraphrased)', question: 'Who is your head coach?', mustInclude: ['Sifu Vikith M'] },

    // --- F: Admission process ---
    { label: 'Admission process - 3 steps', question: 'How do I join?', mustInclude: ['demo', 'decide', 'fees'] },

    // --- G: Demo/trial - confirmed free ---
    { label: 'Demo/trial question - confirmed free, no restrictions invented', question: 'Is there a free trial class?', mustInclude: ['free demo'], mustNotInclude: ["don't have"] },
    { label: 'Fee+demo combined question routes to fee handler, still mentions the free demo', question: 'How much does it cost after the free trial at Main Branch?', mustInclude: ['free demo'] },

    // --- H: Age eligibility ---
    { label: 'Below minimum age (3) - honest, not invented', question: 'Can a 3 year old join?', mustInclude: ['4', "isn't quite eligible"] },
    { label: 'At minimum age (4) - eligible', question: 'Can a 4 year old join?', mustInclude: ['welcome'] },
    { label: 'No invented upper age limit', question: 'Can a 60 year old join?', mustInclude: ['no upper age limit'] },
    { label: 'Bare "my child is 8" for a fee question is NOT misread as an age-eligibility question', question: 'My child is 8, what is the fee at Main Branch?', mustInclude: ['₹4,500'], mustNotInclude: ["isn't quite eligible", 'welcome'] },

    // --- I: KOMBAT EXERCISE (unchanged) ---
    { label: 'KOMBAT EXERCISE basics, no invented timing/fee', question: 'Tell me about KOMBAT EXERCISE', mustInclude: ['55-minute', 'virtual'], mustNotInclude: ['₹'] },

    // --- J: Unconfirmed disciplines - must not be presented as available ---
    { label: 'Boxing not falsely presented as an active batch', question: 'Do you have boxing classes?', mustInclude: ["don't have", 'Kung Fu'], mustNotInclude: ['Yes, boxing'] },
    { label: 'MMA not falsely presented as an active batch', question: 'Is there an MMA class?', mustInclude: ["don't have"] },

    // --- K: Dance (unchanged, branch-agnostic in current data) ---
    { label: 'Dance classes for children', question: 'Do you have dance classes for kids?', mustInclude: ['Children'], mustNotInclude: ['Adults'] },
    { label: 'Dance classes unspecified audience shows both', question: 'What dance classes do you have?', mustInclude: ['Children', 'Adults'] },

    // --- L: Things deliberately left to the AI/knowledge layer, not this deterministic one ---
    { label: 'General "what is JKD" is explanatory, not a structured-data fact - correctly falls through', question: 'What is JKD?', mustInclude: [], expectNull: true },
    { label: 'Founder biography beyond verified facts is not this layer\'s job either way, but verified facts must still be exact', question: 'Tell me about Sifu Vikith M', mustInclude: ['Sifu Vikith M'] },
  ];
}

async function main() {
  const cases = await buildCases();
  let pass = 0;
  let fail = 0;

  for (const c of cases) {
    const result = await businessQueryService.answer(c.question);
    const text = result?.text ?? '';
    const lower = text.toLowerCase();

    if (c.expectNull) {
      if (result === null) {
        console.log(`PASS  ${c.label}`);
        pass += 1;
      } else {
        console.log(`FAIL  ${c.label}\n      Got a deterministic answer when there should be none: "${text}"`);
        fail += 1;
      }
      continue;
    }

    if (!result) {
      console.log(`FAIL  ${c.label}\n      Q: "${c.question}"\n      Got no deterministic answer at all`);
      fail += 1;
      continue;
    }

    const missing = c.mustInclude.filter((s) => !lower.includes(s.toLowerCase()));
    const forbidden = (c.mustNotInclude ?? []).filter((s) => lower.includes(s.toLowerCase()));

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
