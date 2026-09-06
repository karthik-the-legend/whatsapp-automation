// apps/api/src/utils/extractCustomerFacts.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Same conservative philosophy as extractName.ts: a wrong stored fact is
// worse than no fact. Each extractor only fires on an explicit statement,
// never a guess from context or a question the customer asked. These feed
// CustomerProfile.studentAge/preferredBranch/interestedProgram - narrow,
// low-sensitivity fields to make "welcome back" replies feel remembered,
// never a place for anything sensitive.

const BRANCH_PATTERNS: Array<{ branch: string; keywords: RegExp }> = [
  { branch: 'Main Branch', keywords: /\b(main branch|begur|koppa)\b/i },
  { branch: 'ADON Institute', keywords: /\b(adon|hosa road|hosa)\b/i },
];

const BRANCH_INTENT_WORDS = /\b(join|prefer|want|interested|enroll|enrolling|sign up|register|come to|visit|closer to|near)\b/i;

/** Only when an explicit "my son/daughter/child/kid is X" statement appears - never a bare "X years old" (that could be the customer's own age). */
export function extractStudentAge(messageText: string): number | null {
  const match = messageText.match(/\bmy\s+(?:son|daughter|child|kid)\s+is\s+(\d{1,2})\b/i);
  if (!match) return null;
  const age = parseInt(match[1], 10);
  return age >= 1 && age <= 99 ? age : null;
}

/** Only when a branch name/location is paired with an intent-to-join/visit phrase - a bare question like "what's the fee at Hosa Road" isn't necessarily a preference. */
export function extractPreferredBranch(messageText: string): string | null {
  if (!BRANCH_INTENT_WORDS.test(messageText)) return null;
  for (const { branch, keywords } of BRANCH_PATTERNS) {
    if (keywords.test(messageText)) return branch;
  }
  return null;
}

/** Only from explicit "interested in X" / "want to join/learn/do X" phrasing - free text, capped short, never guessed from general conversation. */
export function extractInterestedProgram(messageText: string): string | null {
  const match =
    messageText.match(/\binterested in\s+([a-z][a-z\s]{1,28}?)(?:[.,!?]|\s+(?:for|at|class|classes|batch)\b|$)/i) ??
    messageText.match(/\bwant(?:s|ed)? to\s+(?:join|learn|do)\s+([a-z][a-z\s]{1,28}?)(?:[.,!?]|\s+(?:for|at|class|classes|batch)\b|$)/i);
  if (!match) return null;
  const candidate = match[1].trim();
  return candidate.length >= 2 ? candidate : null;
}
