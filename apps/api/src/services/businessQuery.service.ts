// apps/api/src/services/businessQuery.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// The "Deterministic Business Query Layer": schedules and branch/category
// facts have exactly one correct answer, so they're answered here from
// real structured data (Batch rows - see prisma/seed.ts) BEFORE the AI
// ever runs. Fees are deliberately NOT computed here (or anywhere) - no
// fee has been verified for this schedule, so every fee question gets the
// same honest "I don't have that confirmed" answer rather than a guess.
//
// BRANCH RULE: a class at one branch is never assumed available at
// another - Branch 1 and Hosa Road (Branch 2) are always queried and
// reported separately.
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

const BRANCH_1 = 'Branch 1';
const BRANCH_2 = 'Hosa Road';

const KOMBAT_EXERCISE = {
  durationMinutes: 55,
  virtualAvailable: true,
};

// Disciplines the academy is generally associated with (per Academy
// Identity), but which do NOT currently have a verified active batch in
// the schedule - asking about one of these by name must never be answered
// with Kung Fu batch data as if it were the same thing (see the "only
// state a class is available when explicitly in the verified schedule"
// rule). Kung Fu / Martial Arts and (Western) Dance are the only
// disciplines with real seeded batches.
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

function detectDays(text: string): number[] {
  const found = new Set<number>();
  for (const [name, num] of Object.entries(DAY_LOOKUP)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) found.add(num);
  }
  return [...found];
}

/** "hosa road" -> Branch 2; explicit "branch 1" -> Branch 1; otherwise unspecified (caller decides the default). */
function detectBranch(text: string): string | null {
  if (has(text, 'hosa road', 'hosa', 'branch 2')) return BRANCH_2;
  if (has(text, 'branch 1')) return BRANCH_1;
  return null;
}

/** "child(ren)"/"kid(s)" -> Children; "adult(s)" -> Adults; otherwise unspecified. Used for Dance's two audiences. */
function detectAudience(text: string): 'Children' | 'Adults' | null {
  if (has(text, 'kid', 'kids', 'child', 'children', "my son", "my daughter")) return 'Children';
  if (has(text, 'adult', 'adults', 'grown-up', 'grownup')) return 'Adults';
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

/** A named discipline the academy is generally associated with, but that has no verified active batch - must never be conflated with Kung Fu. */
async function answerUnconfirmedDisciplineQuestion(text: string): Promise<BusinessQueryResult | null> {
  const named = UNCONFIRMED_DISCIPLINES.find((d) => has(text, d));
  if (!named) return null;
  return {
    intent: 'DISCIPLINE_UNCONFIRMED',
    text: `I don't have a currently active ${named.replace(/\b\w/g, (c) => c.toUpperCase())} batch confirmed in our schedule right now. We do have Kung Fu / Martial Arts and Western Dance batches running - want the timings for either of those, or I can have the team confirm ${named} availability for you?`,
  };
}

async function answerKombatExerciseQuestion(text: string): Promise<BusinessQueryResult | null> {
  if (!has(text, 'kombat exercise')) return null;
  return {
    intent: 'KOMBAT_EXERCISE',
    text: `KOMBAT EXERCISE is a ${KOMBAT_EXERCISE.durationMinutes}-minute workout program - available in-person at the academy${KOMBAT_EXERCISE.virtualAvailable ? ', and also as a virtual workout' : ''}. I don't have the specific timings or fee details confirmed here right now - reply "talk to admin" and our team can share those with you.`,
  };
}

async function answerFeeQuestion(text: string): Promise<BusinessQueryResult | null> {
  if (!has(text, 'fee', 'fees', 'cost', 'price', 'pay', 'payment', 'charge', 'charges', 'how much')) return null;
  return {
    intent: 'FEES_UNAVAILABLE',
    text: "I don't have the current fee details available here. The academy team can confirm the latest fees for you - just reply \"talk to admin\".",
  };
}

/** "Batch 3" / "senior batch 1" - Branch 1 Kung Fu batches are numbered 1-6, Senior batches 1-2, per the academy's own numbering. */
async function answerSpecificBatchQuestion(text: string): Promise<BusinessQueryResult | null> {
  const batchNumMatch = text.match(/\bbatch\s*#?\s*(\d)\b/i);
  if (!batchNumMatch) return null;
  const num = parseInt(batchNumMatch[1], 10);

  const all = await getAllBatches();
  const isSenior = has(text, 'senior');
  const pool = all
    .filter((b) => b.branch === BRANCH_1 && b.category === (isSenior ? 'SENIOR' : 'KUNG_FU'))
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

/** Kung Fu / Martial Arts and Senior batches - branch-aware (BRANCH RULE: never conflate Branch 1 and Hosa Road). */
async function answerScheduleQuestion(text: string): Promise<BusinessQueryResult | null> {
  const days = detectDays(text);
  const branch = detectBranch(text);
  const isSenior = has(text, 'senior');
  const asksMorning = has(text, 'morning');
  const asksEvening = has(text, 'evening', 'night');
  const asksAfternoon = has(text, 'afternoon');
  const asksWeekend = has(text, 'weekend', 'weekends');
  const timeCandidates = detectTimeMinutes(text);
  const genericScheduleWord = has(text, 'class', 'classes', 'batch', 'batches', 'timing', 'timings', 'schedule', 'kung fu', 'martial arts');

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
      return { intent: 'SCHEDULE', text: `I don't see a ${isSenior ? 'Senior' : 'Kung Fu'} batch matching that${branchNote} in our current schedule - want me to share the full timings so you can pick what's closest?` };
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
    lines.push(byBranch.size > 1 ? `${branchName}:` : `${isSenior ? 'Senior' : 'Kung Fu'} batches:`);
    lines.push(...batchesInBranch.map(formatBatchLine));
  }

  return { intent: 'SCHEDULE', text: lines.join('\n') };
}

// ---------------------------------------------------------------------------
// Entry point - order matters: more specific rules first.
// ---------------------------------------------------------------------------

const HANDLERS = [
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
