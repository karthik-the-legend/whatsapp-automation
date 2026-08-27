// apps/api/prisma/seed.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Seeds two things the chatbot depends on for grounded, non-hallucinated
// answers: FAQ rows (for exact-text-match questions) and real Batch rows
// (for deterministic schedule/fee lookups - see businessQuery.service.ts,
// which is the actual authority for schedules/fees/belts/personal
// training; these Batch rows are its source of truth).
//
// The FAQ list below intentionally does NOT include fees, timings, age
// eligibility, belt exams, or uniform cost - those are now owned by
// businessQuery.service.ts against real KFA data instead of placeholder
// text, so keeping them here as FAQ rows would risk a stale/wrong answer
// winning a keyword match. What remains here is either genuinely generic
// (contact/holidays/documents) or deliberately honest about not having
// unverified specifics (location/trial/tournament) rather than inventing
// them - see the "don't invent" list this seed was written against.
//
// Re-runnable: clears existing FAQs first. Batches are upserted by name so
// re-running doesn't create duplicates or orphan a real Student's batchId.

import '../src/config/env';
import { prisma, FaqCategory } from '@academy/db';

interface SeedFaq {
  category: FaqCategory;
  question: string;
  answer: string;
  keywords: string[];
}

const faqs: SeedFaq[] = [
  {
    category: 'CONTACT',
    question: 'How can I contact the academy?',
    answer: 'You can message us right here on WhatsApp anytime, or reply "talk to admin" to speak with our team directly.',
    keywords: ['contact', 'phone number', 'call you', 'reach you'],
  },
  {
    category: 'LOCATION',
    question: 'Where are you located?',
    answer: 'I don\'t have our exact address confirmed here yet - reply "talk to admin" and our team will share the exact location with you.',
    keywords: ['location', 'address', 'located', 'directions'],
  },
  {
    category: 'TRIAL_CLASS',
    question: 'Can we try a trial class first?',
    answer: 'I don\'t have trial class details confirmed here right now - reply "talk to admin" and our team can let you know what\'s currently available.',
    keywords: ['trial', 'demo', 'try a class', 'free class'],
  },
  {
    category: 'TOURNAMENT',
    question: 'Do you have tournaments?',
    answer: 'I don\'t have tournament details confirmed here right now - reply "talk to admin" for the latest on any upcoming events.',
    keywords: ['tournament', 'competition', 'compete'],
  },
  {
    category: 'HOLIDAYS',
    question: 'Are you open on public holidays?',
    answer: 'We follow a published holiday calendar - we\'ll always message you in advance if a class is cancelled for a holiday.',
    keywords: ['holiday', 'holidays', 'closed', 'off day'],
  },
  {
    category: 'ADMISSION',
    question: 'How do I enroll my child?',
    answer: 'To enroll, reply "talk to admin" and our team will guide you through the registration process.',
    keywords: ['admission', 'enroll', 'enrolment', 'sign up', 'join'],
  },
  {
    category: 'DOCUMENTS',
    question: 'What documents are needed for admission?',
    answer: 'Just a filled admission form and a copy of an ID/age proof for the student. We\'ll send you the admission form on request.',
    keywords: ['documents', 'documents required', 'id proof', 'paperwork'],
  },
];

interface SeedBatch {
  name: string;
  daysOfWeek: number[]; // 0=Sunday..6=Saturday
  classStartTime: string;
  classEndTime: string;
  feeAmount: number; // paise
  minAge?: number;
}

// Verified KFA business data - see businessQuery.service.ts for how this
// is turned into deterministic answers. Junior batches are numbered 1-6
// per the academy's own numbering; adult batches 1-2. minAge is only set
// where the academy actually stated one (junior: 4+) - no adult minimum
// age was given, so it's deliberately left unset rather than guessed.
const JUNIOR_MONTHLY_FEE_PAISE = 150000; // ₹1,500
const ADULT_MONTHLY_FEE_PAISE = 200000; // ₹2,000

const batches: SeedBatch[] = [
  { name: 'Junior JKD Batch 1', daysOfWeek: [1, 3], classStartTime: '17:00', classEndTime: '18:00', feeAmount: JUNIOR_MONTHLY_FEE_PAISE, minAge: 4 },
  { name: 'Junior JKD Batch 2', daysOfWeek: [6, 0], classStartTime: '09:30', classEndTime: '10:30', feeAmount: JUNIOR_MONTHLY_FEE_PAISE, minAge: 4 },
  { name: 'Junior JKD Batch 3', daysOfWeek: [0], classStartTime: '16:00', classEndTime: '17:00', feeAmount: JUNIOR_MONTHLY_FEE_PAISE, minAge: 4 },
  { name: 'Junior JKD Batch 4', daysOfWeek: [1, 3], classStartTime: '18:00', classEndTime: '19:00', feeAmount: JUNIOR_MONTHLY_FEE_PAISE, minAge: 4 },
  { name: 'Junior JKD Batch 5', daysOfWeek: [6, 0], classStartTime: '10:30', classEndTime: '11:30', feeAmount: JUNIOR_MONTHLY_FEE_PAISE, minAge: 4 },
  { name: 'Junior JKD Batch 6', daysOfWeek: [6, 0], classStartTime: '14:00', classEndTime: '15:00', feeAmount: JUNIOR_MONTHLY_FEE_PAISE, minAge: 4 },
  { name: 'Adult Batch 1', daysOfWeek: [1, 3], classStartTime: '06:30', classEndTime: '07:30', feeAmount: ADULT_MONTHLY_FEE_PAISE },
  { name: 'Adult Batch 2', daysOfWeek: [1, 3], classStartTime: '19:00', classEndTime: '20:00', feeAmount: ADULT_MONTHLY_FEE_PAISE },
];

async function main() {
  console.log('Clearing existing FAQs...');
  await prisma.faq.deleteMany();

  console.log(`Seeding ${faqs.length} FAQs...`);
  await prisma.faq.createMany({ data: faqs.map((f) => ({ ...f, active: true })) });

  console.log(`Upserting ${batches.length} real KFA batches...`);
  for (const b of batches) {
    const existing = await prisma.batch.findFirst({ where: { name: b.name } });
    if (existing) {
      await prisma.batch.update({ where: { id: existing.id }, data: b });
    } else {
      await prisma.batch.create({ data: b });
    }
  }

  // The old placeholder "Evening Kickboxing" test batches (created via the
  // admin dashboard while testing Feature 12) don't match any real KFA
  // batch name and would otherwise show up as a fabricated 9th batch in
  // every schedule answer - remove them, but only if nothing real is
  // still linked to one (never delete out from under a real student).
  const stale = await prisma.batch.findMany({ where: { name: { notIn: batches.map((b) => b.name) } } });
  for (const s of stale) {
    const linkedStudents = await prisma.student.count({ where: { batchId: s.id } });
    if (linkedStudents === 0) {
      await prisma.batch.delete({ where: { id: s.id } });
      console.log(`Removed stale placeholder batch: ${s.name} (${s.id})`);
    } else {
      console.log(`Left stale batch "${s.name}" (${s.id}) in place - ${linkedStudents} student(s) still linked to it.`);
    }
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
