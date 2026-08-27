// apps/api/src/services/businessQuery.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// The "Deterministic Business Query Layer" the KFA rebuild explicitly
// called for: schedules, fees, belt order, personal training days, and
// junior age eligibility are facts with ONE correct answer, so they're
// answered here from real structured data (Batch rows + the constants
// below) BEFORE the AI ever runs - never generated, never at risk of the
// LLM confusing "monthly fee" with "initial total" or inventing a day a
// batch doesn't actually run on. Runs first in chatbot.service.ts's
// decision chain, ahead of FAQ match and the AI fallback.
//
// General/open-ended martial-arts knowledge (JKD history and philosophy
// beyond these quick facts) is deliberately NOT handled here - that's a
// genuinely open-ended explanation task, which is what the AI fallback
// (grounded via systemPrompt.ts's JKD reference block) is for.
//
// Returns null when nothing here answers the question - the caller falls
// through to FAQ match, then the AI. This file never escalates and never
// says "I don't know" on its own; it only answers what it's confident is a
// real match for one of its own categories, or gets out of the way.

import { batchRepository } from '../repositories/batch.repository';

export interface BusinessQueryResult {
  text: string;
  intent: string;
}

// ---------------------------------------------------------------------------
// Verified KFA facts that aren't schedule data - see prisma/seed.ts for the
// batch data this file also draws on. Change these constants (not the
// prompt) if the academy's real fees/belts/personal-training info changes.
// ---------------------------------------------------------------------------

const JUNIOR_FEES = { monthly: 1500, registration: 1500, uniform: 1500, total: 4500 };
const ADULT_FEES = { monthly: 2000, registration: 1500, total: 3500 };
const JUNIOR_MIN_AGE = 4;
const BELT_ORDER = ['White', 'Yellow', 'Orange', 'Green', 'Purple', 'Blue', 'Brown', 'Red', 'Black'];
const PERSONAL_TRAINING_DAYS = ['Tuesday', 'Thursday'];

const JKD = {
  meaning: 'The Way of the Intercepting Fist',
  founder: 'Bruce Lee',
  namedYear: '1967',
  firstWrittenDate: 'July 9, 1967 (per the Bruce Lee Foundation)',
};

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

function detectDays(text: string): number[] {
  const found = new Set<number>();
  for (const [name, num] of Object.entries(DAY_LOOKUP)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) found.add(num);
  }
  return [...found];
}

/** "junior"/"kids"/"child(ren)" -> junior program; "adult"/"grown-up" -> adult program; otherwise unspecified. */
function detectProgram(text: string): 'JUNIOR' | 'ADULT' | null {
  if (has(text, 'junior', 'kid', 'kids', 'child', 'children', "my son", "my daughter")) return 'JUNIOR';
  if (has(text, 'adult', 'adults', 'grown-up', 'grownup')) return 'ADULT';
  return null;
}

function isJuniorBatch(name: string): boolean {
  return /^junior/i.test(name);
}
function isAdultBatch(name: string): boolean {
  return /^adult/i.test(name);
}

function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatBatchLine(batch: { name: string; daysOfWeek: number[]; classStartTime: string; classEndTime: string | null }): string {
  const days = [...batch.daysOfWeek].sort().map((d) => DAY_NAMES[d].slice(0, 3)).join(' & ');
  const start = formatTime12h(batch.classStartTime);
  const end = batch.classEndTime ? formatTime12h(batch.classEndTime) : null;
  const timeRange = end ? `${start}–${end}` : `${start}`;
  return `• ${days} — ${timeRange}`;
}

/**
 * Parses a spoken time like "5 PM", "10:30", "at 4" into candidate 24h
 * minutes-since-midnight values. When am/pm isn't stated and the hour is
 * ambiguous (1-11), returns BOTH readings rather than guessing one -
 * "at 4" could mean 4 AM or 4 PM, and only one of those corresponds to a
 * real batch. The caller checks real batch times against every candidate,
 * so this only ever "matches" a genuinely real, existing class time -
 * never a fabricated one.
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

  // No am/pm stated: both readings are candidates (skip the duplicate for 12).
  const amMinutes = (rawHour % 12) * 60 + minute;
  const pmMinutes = amMinutes + 720;
  return rawHour === 12 ? [amMinutes] : [amMinutes, pmMinutes];
}

async function getBatches() {
  const all = await batchRepository.findAll();
  return {
    junior: all.filter((b) => isJuniorBatch(b.name)),
    adult: all.filter((b) => isAdultBatch(b.name)),
  };
}

// ---------------------------------------------------------------------------
// Rule handlers - checked in order, first match wins.
// ---------------------------------------------------------------------------

async function answerBeltQuestion(text: string): Promise<BusinessQueryResult | null> {
  if (has(text, 'belt') && has(text, 'order', 'sequence', 'progression', 'levels', 'ranks', 'colors', 'colours', 'what')) {
    return {
      intent: 'BELT_SYSTEM',
      text: `Our belt progression is:\n${BELT_ORDER.map((b, i) => `${i + 1}. ${b}`).join('\n')}`,
    };
  }
  if (has(text, 'grading', 'belt exam', 'belt exams', 'belt test', 'belt tests') || (has(text, 'exam', 'exams', 'test', 'tests') && has(text, 'belt'))) {
    return { intent: 'BELT_SYSTEM', text: 'Yes, KFA conducts grading/belt examinations for students.' };
  }
  return null;
}

async function answerPersonalTrainingQuestion(text: string): Promise<BusinessQueryResult | null> {
  if (!has(text, 'personal training', 'private training', 'one-on-one', 'one on one', '1-on-1', '1 on 1')) return null;

  if (detectTimeMinutes(text).length > 0 || has(text, 'time', 'timing', 'what time')) {
    return {
      intent: 'PERSONAL_TRAINING',
      text: `Personal training is available on ${PERSONAL_TRAINING_DAYS.join(' and ')}, with the timing arranged based on your preferred schedule - what time would suit you on ${PERSONAL_TRAINING_DAYS[0]} or ${PERSONAL_TRAINING_DAYS[1]}?`,
    };
  }
  return {
    intent: 'PERSONAL_TRAINING',
    text: `Yes, we offer personal training on ${PERSONAL_TRAINING_DAYS.join(' and ')}. The exact timing is arranged based on what works for you.`,
  };
}

async function answerAgeEligibilityQuestion(text: string): Promise<BusinessQueryResult | null> {
  const asksAge = has(text, 'age', 'old enough', 'how old', 'years old');
  const mentionsChild = has(text, 'child', 'children', 'kid', 'kids', 'son', 'daughter', 'junior');
  if (!asksAge && !(mentionsChild && has(text, 'join', 'enroll', 'start', 'eligible'))) return null;

  return {
    intent: 'JUNIOR_PROGRAM',
    text: `Our junior program is open to children age ${JUNIOR_MIN_AGE} and above. We have six junior batches - happy to share the timings so you can pick whichever works best.`,
  };
}

async function answerJkdQuickFact(text: string): Promise<BusinessQueryResult | null> {
  // "What martial art do you teach kids?" doesn't say "JKD" at all, but
  // it's asking the same thing - which discipline the junior program teaches.
  if (has(text, 'what', 'which') && has(text, 'martial art', 'discipline', 'style') && has(text, 'kid', 'kids', 'child', 'children', 'junior')) {
    return { intent: 'JEET_KUNE_DO', text: 'Jeet Kune Do (JKD).' };
  }

  const mentionsJkd = has(text, 'jkd') || has(text, 'jeet kune do');
  if (!mentionsJkd) return null;

  if (has(text, 'mean', 'meaning', 'translate', 'translation')) {
    return { intent: 'JEET_KUNE_DO', text: `Jeet Kune Do translates to "${JKD.meaning}."` };
  }
  // "when"/"year" checked before "who" - both "who created it" and "when was
  // it created" share the word "created", so the more specific question word
  // (when vs who) has to win, not whichever keyword list happens to come first.
  if (has(text, 'when', 'year', 'started', 'began')) {
    return {
      intent: 'JEET_KUNE_DO',
      text: `Bruce Lee coined and started using the name Jeet Kune Do in ${JKD.namedYear}. The first written appearance of the name is documented as ${JKD.firstWrittenDate}.`,
    };
  }
  if (has(text, 'who', 'creator', 'founder', 'created', 'founded', 'developed', 'invented')) {
    return { intent: 'JEET_KUNE_DO', text: `Jeet Kune Do was developed by ${JKD.founder} as his personal expression of martial arts.` };
  }
  if (has(text, 'history')) {
    return {
      intent: 'JEET_KUNE_DO',
      text: `Bruce Lee coined and started using the name Jeet Kune Do in ${JKD.namedYear}. The first written appearance of the name is documented as ${JKD.firstWrittenDate}.`,
    };
  }
  if (has(text, 'what', 'martial art')) {
    return {
      intent: 'JEET_KUNE_DO',
      text: 'Jeet Kune Do, or JKD, is the martial art and philosophy developed by Bruce Lee. It focuses on simplicity, directness, interception, adaptability and effective movement rather than being restricted to one rigid fighting style.',
    };
  }
  return null;
}

async function answerFeeQuestion(text: string): Promise<BusinessQueryResult | null> {
  const asksFee = has(text, 'fee', 'fees', 'cost', 'price', 'pay', 'payment', 'charge', 'charges', 'how much');
  const asksBreakdown = has(text, 'why', 'breakdown', 'include', 'includes', 'included', 'made up');
  const mentionsAmount = has(text, '4500', '4,500') || has(text, '3500', '3,500');
  if (!asksFee && !(asksBreakdown && mentionsAmount)) return null;

  const program = detectProgram(text) ?? (has(text, '4500', '4,500') ? 'JUNIOR' : has(text, '3500', '3,500') ? 'ADULT' : null);
  const asksMonthlyOnly = has(text, 'monthly', 'per month', 'tuition') && !has(text, 'initial', 'total', 'registration', 'first', 'join', 'enroll');
  const asksRegistrationOnly = has(text, 'registration', 'id fee') && !has(text, 'monthly', 'total', 'initial');
  const asksUniformOnly = has(text, 'uniform') && program !== 'ADULT';
  const asksInitialTotal = has(text, 'initial', 'total', 'upfront', 'first', 'join', 'enroll', 'start') || asksBreakdown;

  if (program === 'JUNIOR' || (program === null && asksUniformOnly)) {
    if (asksUniformOnly) return { intent: 'JUNIOR_FEES', text: `The JKD uniform fee is ₹${JUNIOR_FEES.uniform.toLocaleString('en-IN')}.` };
    if (asksRegistrationOnly) return { intent: 'JUNIOR_FEES', text: `The registration & ID fee is ₹${JUNIOR_FEES.registration.toLocaleString('en-IN')}.` };
    if (asksMonthlyOnly) return { intent: 'JUNIOR_FEES', text: `₹${JUNIOR_FEES.monthly.toLocaleString('en-IN')} per month.` };
    if (asksInitialTotal) {
      return {
        intent: 'JUNIOR_FEES',
        text: `₹${JUNIOR_FEES.total.toLocaleString('en-IN')} in total, including ₹${JUNIOR_FEES.monthly.toLocaleString('en-IN')} monthly fee, ₹${JUNIOR_FEES.registration.toLocaleString('en-IN')} registration & ID fee, and ₹${JUNIOR_FEES.uniform.toLocaleString('en-IN')} for the JKD uniform.`,
      };
    }
    return { intent: 'JUNIOR_FEES', text: `Junior monthly tuition is ₹${JUNIOR_FEES.monthly.toLocaleString('en-IN')}. The initial payment (including registration & uniform) comes to ₹${JUNIOR_FEES.total.toLocaleString('en-IN')} - want the full breakdown?` };
  }

  if (program === 'ADULT') {
    if (asksRegistrationOnly) return { intent: 'ADULT_FEES', text: `The adult registration fee is ₹${ADULT_FEES.registration.toLocaleString('en-IN')}.` };
    if (asksMonthlyOnly) return { intent: 'ADULT_FEES', text: `₹${ADULT_FEES.monthly.toLocaleString('en-IN')} per month.` };
    if (asksInitialTotal) {
      return {
        intent: 'ADULT_FEES',
        text: `The total is ₹${ADULT_FEES.total.toLocaleString('en-IN')}, including ₹${ADULT_FEES.registration.toLocaleString('en-IN')} registration and ₹${ADULT_FEES.monthly.toLocaleString('en-IN')} monthly fee.`,
      };
    }
    return { intent: 'ADULT_FEES', text: `Adult monthly tuition is ₹${ADULT_FEES.monthly.toLocaleString('en-IN')}. The initial payment (including registration) comes to ₹${ADULT_FEES.total.toLocaleString('en-IN')}.` };
  }

  // Program unspecified - ask, rather than guessing which fee schedule they mean.
  return {
    intent: 'FEES_CLARIFY',
    text: 'Are you asking about our junior (kids) program or the adult program? Fees differ between the two, so I want to give you the right numbers.',
  };
}

/** "Batch 3" / "batch #3" style references - junior batches are numbered 1-6, adult 1-2 per KFA's own numbering. */
async function answerSpecificBatchQuestion(text: string): Promise<BusinessQueryResult | null> {
  const batchNumMatch = text.match(/\bbatch\s*#?\s*(\d)\b/i);
  if (!batchNumMatch) return null;
  const num = parseInt(batchNumMatch[1], 10);

  const { junior, adult } = await getBatches();
  const program = detectProgram(text);
  const pool = program === 'ADULT' ? adult : junior; // bare "batch N" refers to KFA's junior numbering unless "adult" is specified
  const batch = pool[num - 1];
  if (!batch) return null;

  const askedDays = detectDays(text);
  if (askedDays.length > 0) {
    const matchesAll = askedDays.every((d) => batch.daysOfWeek.includes(d));
    if (!matchesAll) {
      return {
        intent: 'SCHEDULE',
        text: `${batch.name.replace(/^Junior JKD /, 'Junior ').replace(/^Adult /, 'Adult ')} is currently listed for ${[...batch.daysOfWeek].sort().map((d) => DAY_NAMES[d]).join(' & ')} at ${formatTime12h(batch.classStartTime)}${batch.classEndTime ? `–${formatTime12h(batch.classEndTime)}` : ''} - not the day you asked about. Want me to check another batch for you?`,
      };
    }
  }
  return { intent: 'SCHEDULE', text: `${batch.name} runs ${formatBatchLine(batch).slice(2)}.` };
}

async function answerScheduleQuestion(text: string): Promise<BusinessQueryResult | null> {
  const { junior, adult } = await getBatches();
  const days = detectDays(text);
  const program = detectProgram(text);
  const asksJuniorTimings = has(text, 'junior') && has(text, 'timing', 'timings', 'schedule', 'batch', 'batches');
  const asksAdultTimings = has(text, 'adult') && has(text, 'timing', 'timings', 'schedule', 'batch', 'batches');
  const asksMorning = has(text, 'morning');
  const asksEvening = has(text, 'evening', 'night');
  const asksWeekend = has(text, 'weekend', 'weekends');
  const timeCandidates = detectTimeMinutes(text);
  const genericScheduleWord = has(text, 'class', 'classes', 'batch', 'batches', 'timing', 'timings', 'schedule');

  if (!days.length && !asksJuniorTimings && !asksAdultTimings && !asksMorning && !asksEvening && !asksWeekend && timeCandidates.length === 0 && !genericScheduleWord) {
    return null;
  }

  const lines: string[] = [];

  const wantJunior = asksJuniorTimings || program === 'JUNIOR' || (!asksAdultTimings && program !== 'ADULT');
  const wantAdult = asksAdultTimings || program === 'ADULT' || (!asksJuniorTimings && program !== 'JUNIOR');

  const matchesFilters = (b: { daysOfWeek: number[]; classStartTime: string }) => {
    if (days.length && !days.some((d) => b.daysOfWeek.includes(d))) return false;
    if (asksMorning && parseInt(b.classStartTime.split(':')[0], 10) >= 12) return false;
    if (asksEvening && parseInt(b.classStartTime.split(':')[0], 10) < 16) return false;
    if (asksWeekend && !b.daysOfWeek.some((d) => d === 0 || d === 6)) return false;
    if (timeCandidates.length > 0) {
      const [h, m] = b.classStartTime.split(':').map(Number);
      const batchMinutes = h * 60 + m;
      if (!timeCandidates.includes(batchMinutes)) return false;
    }
    return true;
  };

  const juniorMatches = wantJunior ? junior.filter(matchesFilters) : [];
  const adultMatches = wantAdult ? adult.filter(matchesFilters) : [];

  if (juniorMatches.length === 0 && adultMatches.length === 0) {
    // A real filter was applied (day/time/morning/evening/weekend) and
    // genuinely nothing matches - say so honestly rather than falling
    // through silently or letting the AI guess.
    if (days.length || timeCandidates.length > 0 || asksMorning || asksEvening || asksWeekend) {
      return { intent: 'SCHEDULE', text: "I don't see a batch matching that in our current schedule - want me to share the full timings so you can pick what's closest?" };
    }
    return null;
  }

  if (juniorMatches.length > 0) {
    lines.push('Junior batches:', ...juniorMatches.map(formatBatchLine));
  }
  if (adultMatches.length > 0) {
    if (lines.length) lines.push('');
    lines.push('Adult batches:', ...adultMatches.map(formatBatchLine));
  }

  return { intent: 'SCHEDULE', text: lines.join('\n') };
}

// ---------------------------------------------------------------------------
// Entry point - order matters: more specific rules first.
// ---------------------------------------------------------------------------

const HANDLERS = [
  answerSpecificBatchQuestion,
  answerBeltQuestion,
  answerPersonalTrainingQuestion,
  answerJkdQuickFact,
  answerFeeQuestion,
  answerAgeEligibilityQuestion,
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
