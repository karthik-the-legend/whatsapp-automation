// apps/api/scripts/printConversations.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Since local testing can't actually receive a WhatsApp reply (no real
// Meta credentials yet), this is how you verify the chatbot pipeline
// worked: it queries the same Conversation/Message rows the app itself
// writes to, and prints them in order. If FAQ matching worked, you'll see
// the FAQ's exact answer text as an OUTBOUND message here.
//
// Usage (from apps/api): npx tsx scripts/printConversations.ts

import '../src/config/env';
import { prisma } from '@academy/db';

async function main() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: 'desc' },
    take: 5,
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      student: true,
    },
  });

  if (conversations.length === 0) {
    console.log('No conversations yet - run `npm run test:webhook` first.');
    return;
  }

  for (const convo of conversations) {
    console.log(`\n=== Conversation ${convo.id} — ${convo.phone} — status: ${convo.status} ===`);
    if (convo.currentIntent) console.log(`   current intent: ${convo.currentIntent}`);
    if (convo.escalationReason) console.log(`   escalated: ${convo.escalationReason}`);

    for (const msg of convo.messages) {
      const tag = msg.direction === 'INBOUND' ? '→ IN ' : '← OUT';
      const meta = msg.intent ? ` [category: ${msg.intent}]` : '';
      console.log(`   ${tag}  ${msg.body}${meta}`);
    }
  }
}

main()
  .catch((err) => {
    console.error('Failed to read conversations:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
