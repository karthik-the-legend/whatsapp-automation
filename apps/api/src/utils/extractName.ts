// apps/api/src/utils/extractName.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Deliberately conservative - a wrong stored name ("Hi Good!" because
// someone typed "I'm good, thanks") is worse than no name at all. Only
// extracts from an explicit self-identification phrasing, never from an
// arbitrary capitalized word in the message, and rejects common non-name
// words that happen to follow the same phrasing ("I'm interested", "I'm
// looking for classes").

const NAME_PATTERNS = [
  /\bmy name is\s+([a-z]+)/i,
  /\bthis is\s+([a-z]+)\s*(?:speaking|here)?[.!]?\s*$/i,
  /\bcall me\s+([a-z]+)/i,
  /\bi'?m\s+([a-z]+)\b/i,
  /\bi am\s+([a-z]+)\b/i,
];

// Common words that grammatically fit "I'm ___" / "this is ___" but are
// never a name - without this list, "I'm good", "I'm interested", "this is
// great" would all get stored as someone's name.
const NOT_A_NAME = new Set([
  'good', 'fine', 'ok', 'okay', 'great', 'interested', 'looking', 'here',
  'back', 'sure', 'not', 'just', 'still', 'also', 'trying', 'asking',
  'calling', 'texting', 'messaging', 'writing', 'wondering', 'curious',
  'confused', 'sorry', 'happy', 'glad', 'new', 'done', 'ready', 'busy',
  'available', 'free', 'sir', 'maam', 'madam', 'neha',
]);

export function extractName(messageText: string): string | null {
  for (const pattern of NAME_PATTERNS) {
    const match = messageText.match(pattern);
    if (!match) continue;

    const candidate = match[1];
    if (NOT_A_NAME.has(candidate.toLowerCase())) continue;
    if (candidate.length < 2 || candidate.length > 20) continue;

    return candidate[0].toUpperCase() + candidate.slice(1).toLowerCase();
  }
  return null;
}
