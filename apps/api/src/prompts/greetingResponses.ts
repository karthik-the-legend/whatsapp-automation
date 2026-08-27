// apps/api/src/prompts/greetingResponses.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Pure-greeting replies are answered deterministically (no AI call needed -
// there's nothing to look up, and it keeps the identity claim - "Neha, the
// receptionist at Kombat Fitness Academy" - guaranteed correct every time
// rather than left to the LLM to phrase consistently). Variety comes from
// picking randomly between a few hand-written templates each time, per
// PART 1's "do NOT use the exact same robotic sentence every time" -
// tests assert on substrings (contains "Neha", "receptionist", etc.), not
// exact text, so randomness here doesn't make anything harder to verify.

// Every variant must state all four things (see PART 1): her name, that
// she's the receptionist, which academy, and an offer to help - varying
// wording is fine, dropping any of those four is not.
const FIRST_TIME_TEMPLATES = [
  "Hello! 😊 I'm Neha, the receptionist at Kombat Fitness Academy. How can I help you?",
  "Hi! 👋 I'm Neha, receptionist at Kombat Fitness Academy. How can I help you today?",
  "Hello! 😊 Neha here, the receptionist at Kombat Fitness Academy. How may I assist you?",
];

const RETURNING_TEMPLATES = [
  'Hi again! 😊 How can I help you?',
  'Hello again! 😊 What would you like to know?',
  'Hey! 😊 How can I help you today?',
  'Welcome back! 😊 How can I help you?',
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export interface CustomerGreetingContext {
  isFirstInteraction: boolean;
  name: string | null;
}

/** Full reply for a message that's ONLY a greeting - nothing else to answer. */
export function composeGreeting(ctx: CustomerGreetingContext): string {
  if (ctx.isFirstInteraction) return pick(FIRST_TIME_TEMPLATES);

  // Use the name sometimes, not every time - PART 13: "use it occasionally
  // and naturally", never force it into every response.
  if (ctx.name && Math.random() < 0.4) {
    return `Hi ${ctx.name}! 😊 How can I help you?`;
  }
  return pick(RETURNING_TEMPLATES);
}

/** Short lead-in for a "greeting + question" message (PART 7/8) - real content follows right after, so this stays brief. */
export function composeGreetingPrefix(ctx: CustomerGreetingContext): string {
  if (ctx.isFirstInteraction) {
    return "Hello! 😊 I'm Neha, the receptionist at Kombat Fitness Academy.";
  }
  if (ctx.name && Math.random() < 0.4) {
    return `Hi ${ctx.name}! 😊`;
  }
  return pick(['Hi again! 😊', 'Hello again! 😊', 'Hey! 😊']);
}
