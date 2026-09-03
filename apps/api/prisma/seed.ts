// apps/api/prisma/seed.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Seeds two things the chatbot depends on for grounded, non-hallucinated
// answers: FAQ rows (for exact-text-match questions) and real Batch rows
// (for deterministic schedule lookups - see businessQuery.service.ts,
// which is the actual authority for schedules/branches/categories; these
// Batch rows are its source of truth).
//
// This is the verified KOMBAT Fitness Academy master data (branch-aware:
// Branch 1 + Hosa Road/Branch 2). No fee amounts are seeded anywhere -
// none have been verified for this schedule, and businessQuery.service.ts
// is written to say so honestly rather than guess (see its FEES RULE).
// Same for age ranges - only the qualitative "audience" the source data
// actually states (Children/Adults/Men & Ladies) is stored, never a
// invented numeric age boundary.
//
// Re-runnable: clears existing FAQs first. Batches are upserted by
// (name + branch) so re-running doesn't create duplicates or orphan a
// real Student's batchId.

import '../src/config/env';
import { prisma, FaqCategory, BatchCategory } from '@academy/db';

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
    answer: 'I don\'t have our Branch 1 address confirmed here yet - reply "talk to admin" and our team will share the exact location with you. Our other branch is at Hosa Road.',
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
  branch: string;
  category: BatchCategory;
  audience?: string;
  daysOfWeek: number[]; // 0=Sunday..6=Saturday
  classStartTime: string;
  classEndTime: string;
}

const BRANCH_1 = 'Branch 1';
const BRANCH_2 = 'Hosa Road';

const batches: SeedBatch[] = [
  // Branch 1 - Kung Fu / Martial Arts (6 batches)
  { name: 'Kung Fu Batch 1', branch: BRANCH_1, category: 'KUNG_FU', daysOfWeek: [1, 3], classStartTime: '17:00', classEndTime: '18:00' },
  { name: 'Kung Fu Batch 2', branch: BRANCH_1, category: 'KUNG_FU', daysOfWeek: [6, 0], classStartTime: '09:30', classEndTime: '10:30' },
  { name: 'Kung Fu Batch 3', branch: BRANCH_1, category: 'KUNG_FU', daysOfWeek: [6, 0], classStartTime: '16:00', classEndTime: '17:00' },
  { name: 'Kung Fu Batch 4', branch: BRANCH_1, category: 'KUNG_FU', daysOfWeek: [1, 3], classStartTime: '18:00', classEndTime: '19:00' },
  { name: 'Kung Fu Batch 5', branch: BRANCH_1, category: 'KUNG_FU', daysOfWeek: [6, 0], classStartTime: '10:30', classEndTime: '11:30' },
  { name: 'Kung Fu Batch 6', branch: BRANCH_1, category: 'KUNG_FU', daysOfWeek: [6, 0], classStartTime: '14:00', classEndTime: '15:00' },

  // Branch 1 - Senior Kung Fu / Martial Arts (Men & Ladies)
  { name: 'Senior Batch 1', branch: BRANCH_1, category: 'SENIOR', audience: 'Men & Ladies', daysOfWeek: [1, 3], classStartTime: '06:30', classEndTime: '07:30' },
  { name: 'Senior Batch 2', branch: BRANCH_1, category: 'SENIOR', audience: 'Men & Ladies', daysOfWeek: [1, 3], classStartTime: '19:00', classEndTime: '20:00' },

  // Branch 1 - Western Dance
  { name: 'Dance Batch 1', branch: BRANCH_1, category: 'DANCE', audience: 'Children', daysOfWeek: [2, 4], classStartTime: '17:00', classEndTime: '18:00' },
  { name: 'Dance Batch 2', branch: BRANCH_1, category: 'DANCE', audience: 'Adults', daysOfWeek: [2, 4], classStartTime: '18:00', classEndTime: '19:00' },

  // Branch 2 - Hosa Road - Kung Fu / Martial Arts
  { name: 'Kung Fu Batch', branch: BRANCH_2, category: 'KUNG_FU', daysOfWeek: [6, 0], classStartTime: '17:30', classEndTime: '18:30' },
];

async function main() {
  console.log('Clearing existing FAQs...');
  await prisma.faq.deleteMany();

  console.log(`Seeding ${faqs.length} FAQs...`);
  await prisma.faq.createMany({ data: faqs.map((f) => ({ ...f, active: true })) });

  console.log(`Upserting ${batches.length} real KOMBAT Fitness Academy batches...`);
  for (const b of batches) {
    const existing = await prisma.batch.findFirst({ where: { name: b.name, branch: b.branch } });
    if (existing) {
      await prisma.batch.update({ where: { id: existing.id }, data: b });
    } else {
      await prisma.batch.create({ data: b });
    }
  }

  // Anything seeded under an old naming scheme (e.g. "Junior JKD Batch 1",
  // "Adult Batch 1", or earlier placeholder test batches) doesn't match
  // this run's (name, branch) pairs and would otherwise show up as a
  // fabricated extra batch in every schedule answer - remove it, but only
  // if nothing real is still linked to it (never delete out from under a
  // real student).
  const currentKeys = new Set(batches.map((b) => `${b.name}::${b.branch}`));
  const allBatches = await prisma.batch.findMany();
  for (const existingBatch of allBatches) {
    if (currentKeys.has(`${existingBatch.name}::${existingBatch.branch}`)) continue;
    const linkedStudents = await prisma.student.count({ where: { batchId: existingBatch.id } });
    if (linkedStudents === 0) {
      await prisma.batch.delete({ where: { id: existingBatch.id } });
      console.log(`Removed stale batch: ${existingBatch.name} / ${existingBatch.branch} (${existingBatch.id})`);
    } else {
      console.log(`Left stale batch "${existingBatch.name}" (${existingBatch.id}) in place - ${linkedStudents} student(s) still linked to it.`);
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
