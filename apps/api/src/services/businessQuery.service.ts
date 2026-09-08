// apps/api/src/services/businessQuery.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// The "Deterministic Business Query Layer": schedules, branch/category
// facts, fees, founder identity, admission process, the free demo, and
// age eligibility all have exactly one correct answer, so they're answered
// here from real verified data BEFORE the AI ever runs - see
// knowledge/*.md for the underlying source documents these numbers were
// taken from, and docs/KNOWLEDGE_BASE.md for how to update them.
//
// BRANCH RULE: a class/fee at one branch is never assumed available at
// another - Main Branch (Begur-Koppa Road) and ADON Institute (Hosa Road)
// are always queried and reported separately. ADON Institute has no
// verified Senior program - never imply it does.
//
// Returns null when nothing here answers the question - the caller falls
// through to FAQ match, then the AI. This file never escalates and never
// invents; it only answers what it's confident matches one of its own
// categories, or gets out of the way.

import { Batch } from '@academy/db';
import { batchRepository } from '../repositories/batch.repository';

export interface BusinessQueryResult {
  text: string;
  intent: string;
}

const MAIN_BRANCH = 'Main Branch';
const ADON_INSTITUTE = 'ADON Institute';

const KOMBAT_EXERCISE = {
  durationMinutes: 55,
  virtualAvailable: true,
};

const FOUNDER = {
  name: 'Sifu Vikith M',
  title: 'Founder and Head Coach',
  facts: '20+ years of experience and is a Former Indian Gold Medalist',
};

const MINIMUM_AGE = 4;

// Verified fee structures - see knowledge/fees/*.md for the source
// documents. Amounts are in rupees. Keep these two in sync whenever a fee
// changes - the markdown files reference these constants by name.
const FEE_PROFILES = {
  MAIN_JUNIOR: {
    label: 'Main Branch (Junior)',
    monthly: 1500,
    registration: 1500,
    uniform: 1500,
    firstMonthTotal: 4500,
  },
  MAIN_SENIOR: {
    label: 'Main Branch (Senior)',
    monthly: 2000,
    registration: 1500,
    uniform: 2000,
    firstMonthExclUniform: 3500,
    firstMonthInclUniform: 5500,
  },
  ADON_JUNIOR: {
    label: 'ADON Institute (Junior)',
    monthly: 2000,
    registration: 1500,
    uniform: 1500,
    firstMonthTotal: 5000,
  },
} as const;

// Disciplines the academy is generally associated with (per Academy
// Identity), but which do NOT currently have a verified active batch in
// the schedule - asking about one of these by name must never be answered
// with Kung Fu batch data as if it were the same thing (see the "only
// state a class is available when explicitly in the verified schedule"
// rule). Kung Fu/JKD and (Western) Dance are the only disciplines with
// real seeded batches.
const UNCONFIRMED_DISCIPLINES = ['karate', 'boxing', 'kickboxing', 'brazilian jiu-jitsu', 'jiu-jitsu', 'jiujitsu', 'bjj', 'muay thai', 'mma', 'mixed martial arts'];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_LOOKUP: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};

function normalize(text: string): string {
  return text.toLowerCase();
}

function has(text: string, ...words: string[]): boolean {
  return words.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(text));
}

/** Named days plus "today"/"tomorrow" resolved against the real current date - never a guessed/fixed day. */
function detectDays(text: string): number[] {
  const found = new Set<number>();
  for (const [name, num] of Object.entries(DAY_LOOKUP)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) found.add(num);
  }
  if (/\btoday\b/i.test(text)) found.add(new Date().getDay());
  if (/\btomorrow\b/i.test(text)) found.add((new Date().getDay() + 1) % 7);
  return [...found];
}

/** Recognizes both branches by name, location, and the old "Branch 1/2" numbering some customers may still use. */
function detectBranch(text: string): string | null {
  if (has(text, 'hosa road', 'hosa', 'adon', 'branch 2')) return ADON_INSTITUTE;
  if (has(text, 'main branch', 'begur', 'koppa', 'branch 1')) return MAIN_BRANCH;
  return null;
}

/** "child(ren)"/"kid(s)" -> Children; "adult(s)" -> Adults; otherwise unspecified. Used for Dance's two audiences. */
function detectAudience(text: string): 'Children' | 'Adults' | null {
  if (has(text, 'kid', 'kids', 'child', 'children', "my son", "my daughter")) return 'Children';
  if (has(text, 'adult', 'adults', 'grown-up', 'grownup')) return 'Adults';
  return null;
}

/** Pulls an explicit age like "8 years old", "she's 8", "my son is 8", "a 3-year-old" - only ever used for eligibility, never guessed. */
function detectAge(text: string): number | null {
  const patterns = [
    /\b(\d{1,2})\s*[- ]?\s*years?\s*[- ]?\s*old\b/i,
    /\b(?:my\s+(?:son|daughter|child|kid)\s+is)\s+(\d{1,2})\b/i,
    /\b(?:is|age)\s+(\d{1,2})\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatBatchLine(batch: Pick<Batch, 'daysOfWeek' | 'classStartTime' | 'classEndTime'>): string {
  const days = [...batch.daysOfWeek].sort().map((d) => DAY_NAMES[d].slice(0, 3)).join(' & ');
  const start = formatTime12h(batch.classStartTime);
  const end = batch.classEndTime ? formatTime12h(batch.classEndTime) : null;
  const timeRange = end ? `${start}–${end}` : `${start}`;
  return `• ${days} — ${timeRange}`;
}

/**
 * Parses a spoken time like "5 PM", "10:30", "at 4" into candidate 24h
 * minutes-since-midnight values. When am/pm isn't stated and the hour is
 * ambiguous (1-11), returns BOTH readings rather than guessing one - the
 * caller checks real batch times against every candidate, so this only
 * ever "matches" a genuinely real, existing class time.
 */
function detectTimeMinutes(text: string): number[] {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return [];
  const rawHour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.toLowerCase();
  if (rawHour < 1 || rawHour > 12) return [];

  if (meridiem === 'pm') return [(rawHour % 12) * 60 + 720 + minute];
  if (meridiem === 'am') return [(rawHour % 12) * 60 + minute];

  const amMinutes = (rawHour % 12) * 60 + minute;
  const pmMinutes = amMinutes + 720;
  return rawHour === 12 ? [amMinutes] : [amMinutes, pmMinutes];
}

async function getAllBatches(): Promise<Batch[]> {
  return batchRepository.findAll();
}

// ---------------------------------------------------------------------------
// Rule handlers - checked in order, first match wins.
// ---------------------------------------------------------------------------

async function answerFounderQuestion(text: string): Promise<BusinessQueryResult | null> {
  if (!has(text, 'founder', 'who started', 'who runs the academy', 'head coach', 'sifu', 'who owns', 'who is the owner')) return null;
  return {
    intent: 'FOUNDER',
    text: `${FOUNDER.name} is our ${FOUNDER.title} - ${FOUNDER.facts}. No other certifications or affiliations are listed here, but our team can share more if you'd like.`,
  };
}

async function answerAdmissionProcessQuestion(text: string): Promise<BusinessQueryResult | null> {
  if (!has(text, 'admission process', 'how do i join', 'how to join', 'how do i enroll', 'how to enroll', 'enrollment process', 'how to admit', 'how do i register', 'how to register')) return null;
  return {
    intent: 'ADMISSION_PROCESS',
    text: "Getting started is simple: 1) come in for a free demo/trial session, 2) decide if you'd like to join, 3) complete the fees and you're in. Want me to help you set up a demo?",
  };
}

/** "Is there a free trial?" - a quick fact. Combined fee+demo questions (e.g. "what's the fee after the trial") route to the fee handler instead, which already mentions the free demo. */
async function answerDemoQuestion(text: string): Promise<BusinessQueryResult | null> {
  const asksDemo = has(text, 'demo', 'trial', 'free class', 'free session');
  const asksFee = has(text, 'fee', 'fees', 'cost', 'price', 'pay', 'payment', 'charge', 'charges', 'how much');
  if (!asksDemo || asksFee) return null;
  return {
    intent: 'DEMO',
    text: "Yes! We offer one free demo/trial session for anyone interested, at either branch. Want me to help you book one?",
  };
}

/** Age eligibility - minimum age 4, no upper limit has been verified. Only triggers when an explicit age AND an eligibility-style question appear together, so it never fires on "my child is 8, what's the fee" (that's a fee question, not an eligibility one). */
async function answerAgeEligibilityQuestion(text: string): Promise<BusinessQueryResult | null> {
  const eligibilityPhrasing = has(text, 'join', 'eligible', 'enroll', 'allowed', 'age limit', 'minimum age', 'maximum age', 'too young', 'too old', 'old enough', 'qualify');
  if (!eligibilityPhrasing) return null;
  const age = detectAge(text);
  if (age == null) return null;

  if (age < MINIMUM_AGE) {
    return {
      intent: 'AGE_ELIGIBILITY',
      text: `Our minimum age is ${MINIMUM_AGE}, so a ${age}-year-old isn't quite eligible yet - but we'd love to see them once they turn ${MINIMUM_AGE}!`,
    };
  }
  return {
    intent: 'AGE_ELIGIBILITY',
    text: `Yes, that works - we welcome anyone aged ${MINIMUM_AGE} and up, and there's no upper age limit.`,
  };
}

/** A named discipline the academy is generally associated with, but that has no verified active batch - must never be conflated with Kung Fu/JKD. */
async function answerUnconfirmedDisciplineQuestion(text: string): Promise<BusinessQueryResult | null> {
  const named = UNCONFIRMED_DISCIPLINES.find((d) => has(text, d));
  if (!named) return null;
  return {
    intent: 'DISCIPLINE_UNCONFIRMED',
    text: `I don't have a currently active ${named.replace(/\b\w/g, (c) => c.toUpperCase())} batch confirmed in our schedule right now. We do have Kung Fu/JKD and Western Dance batches running - want the timings for either of those, or I can have the team confirm ${named} availability for you?`,
  };
}

async function answerKombatExerciseQuestion(text: string): Promise<BusinessQueryResult | null> {
  if (!has(text, 'kombat exercise')) return null;
  return {
    intent: 'KOMBAT_EXERCISE',
    text: `KOMBAT EXERCISE is a ${KOMBAT_EXERCISE.durationMinutes}-minute workout program - available in-person at the academy${KOMBAT_EXERCISE.virtualAvailable ? ', and also as a virtual workout' : ''}. I don't have the specific timings or fee details confirmed here right now - reply "talk to admin" and our team can share those with you.`,
  };
}

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatFeeAnswer(profile: typeof FEE_PROFILES[keyof typeof FEE_PROFILES]): string {
  if ('firstMonthExclUniform' in profile) {
    return `At ${profile.label}, it's ${rupees(profile.monthly)}/month. After your free demo, if you decide to join: ${rupees(profile.registration)} registration + ${rupees(profile.monthly)} for the first month's training comes to ${rupees(profile.firstMonthExclUniform)}, plus the uniform is a separate ${rupees(profile.uniform)} charge (${rupees(profile.firstMonthInclUniform)} total including the uniform). From the second month, it's just ${rupees(profile.monthly)}/month.`;
  }
  return `At ${profile.label}, it's ${rupees(profile.monthly)}/month. After your free demo, if you decide to join, the first month total is ${rupees(profile.firstMonthTotal)} (${rupees(profile.registration)} registration + ${rupees(profile.uniform)} uniform + ${rupees(profile.monthly)} first month's fee). From the second month, it's just ${rupees(profile.monthly)}/month.`;
}

async function answerFeeQuestion(text: string): Promise<BusinessQueryResult | null> {
  if (!has(text, 'fee', 'fees', 'cost', 'price', 'pay', 'payment', 'charge', 'charges', 'how much')) return null;

  const isSenior = has(text, 'senior');
  let branch = detectBranch(text);

  // ADON Institute has no verified Senior program - a Senior question with
  // no branch stated can only mean Main Branch, so it's not actually
  // ambiguous.
  if (!branch && isSenior) branch = MAIN_BRANCH;

  if (!branch) {
    return {
      intent: 'FEE_CLARIFY_BRANCH',
      text: 'Which branch are you asking about - Main Branch (Begur–Koppa Road) or ADON Institute (Hosa Road)? Fees differ slightly between them.',
    };
  }

  if (branch === ADON_INSTITUTE && isSenior) {
    return {
      intent: 'FEE_UNAVAILABLE',
      text: "ADON Institute doesn't have a verified Senior program right now - only Junior batches are currently running there. Main Branch does have a Senior program if that helps.",
    };
  }

  const profile = branch === ADON_INSTITUTE ? FEE_PROFILES.ADON_JUNIOR : isSenior ? FEE_PROFILES.MAIN_SENIOR : FEE_PROFILES.MAIN_JUNIOR;
  return { intent: 'FEES', text: formatFeeAnswer(profile) };
}

/** "Batch 3" / "senior batch 1" - Main Branch Kung Fu batches are numbered 1-6, Senior batches 1-2, per the academy's own numbering. */
async function answerSpecificBatchQuestion(text: string): Promise<BusinessQueryResult | null> {
  const batchNumMatch = text.match(/\bbatch\s*#?\s*(\d)\b/i);
  if (!batchNumMatch) return null;
  const num = parseInt(batchNumMatch[1], 10);

  const all = await getAllBatches();
  const isSenior = has(text, 'senior');
  const pool = all
    .filter((b) => b.branch === MAIN_BRANCH && b.category === (isSenior ? 'SENIOR' : 'KUNG_FU'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const batch = pool[num - 1];
  if (!batch) return null;

  const askedDays = detectDays(text);
  if (askedDays.length > 0) {
    const matchesAll = askedDays.every((d) => batch.daysOfWeek.includes(d));
    if (!matchesAll) {
      return {
        intent: 'SCHEDULE',
        text: `${batch.name} is currently listed for ${[...batch.daysOfWeek].sort().map((d) => DAY_NAMES[d]).join(' & ')} at ${formatTime12h(batch.classStartTime)}${batch.classEndTime ? `–${formatTime12h(batch.classEndTime)}` : ''} - not the day you asked about. Want me to check another batch for you?`,
      };
    }
  }
  return { intent: 'SCHEDULE', text: `${batch.name} runs ${formatBatchLine(batch).slice(2)}.` };
}

async function answerDanceQuestion(text: string): Promise<BusinessQueryResult | null> {
  if (!has(text, 'dance', 'dancing')) return null;

  const all = await getAllBatches();
  const audience = detectAudience(text);
  const matches = all.filter((b) => b.category === 'DANCE' && (!audience || b.audience === audience));
  if (matches.length === 0) return null;

  const lines = matches.map((b) => `• ${b.audience} — ${formatBatchLine(b).slice(2)}`);
  return { intent: 'DANCE', text: `Our Western Dance batches:\n${lines.join('\n')}` };
}

/** Kung Fu/JKD and Senior batches - branch-aware (BRANCH RULE: never conflate Main Branch and ADON Institute). */
async function answerScheduleQuestion(text: string): Promise<BusinessQueryResult | null> {
  const days = detectDays(text);
  const branch = detectBranch(text);
  const isSenior = has(text, 'senior');
  const asksMorning = has(text, 'morning');
  const asksEvening = has(text, 'evening', 'night');
  const asksAfternoon = has(text, 'afternoon');
  const asksWeekend = has(text, 'weekend', 'weekends');
  const timeCandidates = detectTimeMinutes(text);
  // Deliberately NOT "martial arts" - that phrase shows up in generic
  // conceptual questions ("is martial arts good for a shy kid?") that have
  // nothing to do with schedules, and was wrongly dumping the full batch
  // list for those (a real bug found via production testing).
  const genericScheduleWord = has(text, 'class', 'classes', 'batch', 'batches', 'timing', 'timings', 'schedule', 'kung fu');

  // A bare number alone (timeCandidates) is deliberately NOT enough to open
  // this gate by itself - "my daughter is 6" would otherwise get misread as
  // "class at 6" (a real bug found via testing). It only REFINES an
  // already-established schedule question.
  if (!days.length && !isSenior && !asksMorning && !asksEvening && !asksAfternoon && !asksWeekend && !genericScheduleWord) {
    return null;
  }

  const all = await getAllBatches();
  const category = isSenior ? 'SENIOR' : 'KUNG_FU';

  const matchesFilters = (b: Batch) => {
    if (b.category !== category) return false;
    if (branch && b.branch !== branch) return false;
    if (days.length && !days.some((d) => b.daysOfWeek.includes(d))) return false;
    const startHour = parseInt(b.classStartTime.split(':')[0], 10);
    if (asksMorning && startHour >= 12) return false;
    if (asksAfternoon && (startHour < 12 || startHour >= 17)) return false;
    if (asksEvening && startHour < 17) return false;
    if (asksWeekend && !b.daysOfWeek.some((d) => d === 0 || d === 6)) return false;
    if (timeCandidates.length > 0) {
      const [h, m] = b.classStartTime.split(':').map(Number);
      if (!timeCandidates.includes(h * 60 + m)) return false;
    }
    return true;
  };

  const matches = all.filter(matchesFilters);

  if (matches.length === 0) {
    if (days.length || timeCandidates.length > 0 || asksMorning || asksEvening || asksAfternoon || asksWeekend) {
      const branchNote = branch ? ` at ${branch}` : '';
      return { intent: 'SCHEDULE', text: `I don't see a ${isSenior ? 'Senior' : 'Kung Fu/JKD'} batch matching that${branchNote} in our current schedule - want me to share the full timings so you can pick what's closest?` };
    }
    return null;
  }

  // Group by branch so a multi-branch answer is never presented as one
  // undifferentiated list (BRANCH RULE).
  const byBranch = new Map<string, Batch[]>();
  for (const b of matches) {
    if (!byBranch.has(b.branch)) byBranch.set(b.branch, []);
    byBranch.get(b.branch)!.push(b);
  }

  const lines: string[] = [];
  for (const [branchName, batchesInBranch] of byBranch) {
    if (lines.length) lines.push('');
    lines.push(byBranch.size > 1 ? `${branchName}:` : `${isSenior ? 'Senior' : 'Kung Fu/JKD'} batches:`);
    lines.push(...batchesInBranch.map(formatBatchLine));
  }

  return { intent: 'SCHEDULE', text: lines.join('\n') };
}

// ---------------------------------------------------------------------------
// Entry point - order matters: more specific rules first.
// ---------------------------------------------------------------------------

const HANDLERS = [
  answerFounderQuestion,
  answerAdmissionProcessQuestion,
  answerDemoQuestion,
  answerAgeEligibilityQuestion,
  answerKombatExerciseQuestion,
  answerUnconfirmedDisciplineQuestion,
  answerSpecificBatchQuestion,
  answerDanceQuestion,
  answerFeeQuestion,
  answerScheduleQuestion,
];

async function answer(messageText: string): Promise<BusinessQueryResult | null> {
  const text = normalize(messageText);
  for (const handler of HANDLERS) {
    // eslint-disable-next-line no-await-in-loop
    const result = await handler(text);
    if (result) return result;
  }
  return null;
}

export const businessQueryService = { answer };
