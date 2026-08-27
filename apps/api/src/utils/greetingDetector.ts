// apps/api/src/utils/greetingDetector.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Pure function, no DB/side effects - deliberately not exact-string
// matching (see PART 6 of the receptionist spec: "hi"/"hii"/"hiii"/"heyy"/
// "helloooo"/"hi sir"/"hi maam"/"hello madam"/"hi neha" all need to count).
// One anchored regex handles the repeated-letter variants (h+i+ matches
// "hi"/"hii"/"hiii"...) and the trailing polite-address/name suffix
// ("sir"/"ma'am"/"neha"/"there") in one pass, then whatever's left after
// stripping that prefix is the real content - empty means a pure greeting,
// non-empty means "greeting + question" (see chatbot.service.ts, which
// answers the remainder normally and only adds a greeting lead-in).

const GREETING_CORE = "(?:h+i+|h+e+y+a?|h+e+l+l+o+|good\\s+(?:morning|afternoon|evening)|namaste)";
const POLITE_SUFFIX = "(?:\\s+(?:there|sir|ma'?am|maam|mam|madam|neha))?";
const LEADING_GREETING = new RegExp(`^${GREETING_CORE}${POLITE_SUFFIX}[\\s,!.]*`, 'i');

export interface GreetingDetection {
  isGreeting: boolean;
  /** Text remaining after stripping the greeting prefix - empty for a pure greeting. */
  remainder: string;
}

export function detectGreeting(rawText: string): GreetingDetection {
  const trimmed = rawText.trim();
  const match = trimmed.match(LEADING_GREETING);

  if (!match) {
    return { isGreeting: false, remainder: trimmed };
  }

  return { isGreeting: true, remainder: trimmed.slice(match[0].length).trim() };
}
