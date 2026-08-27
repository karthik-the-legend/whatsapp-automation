// apps/api/prisma/seed.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// The chatbot (Feature 3) needs real FAQ rows to match against - without
// this, every question falls through to the AI provider, which needs a
// real ANTHROPIC_API_KEY/OPENAI_API_KEY you may not have configured yet.
// Seeding covers every category the spec lists (#3, Parent Enquiry
// Chatbot) so you can test FAQ matching immediately, with zero AI cost.
//
// Re-runnable: clears existing FAQs first, so running this twice doesn't
// create duplicates. Edit the `answer` text freely to match your actual
// academy details before running - this is meant to be customized, not
// used verbatim in production.

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
    category: 'FEES',
    question: 'What are your fees?',
    answer: 'Our monthly fee is ₹2,500 per student. We also offer quarterly plans and sibling discounts - reply "talk to admin" if you\'d like the exact breakdown for your batch.',
    keywords: ['fee', 'fees', 'cost', 'price', 'charges'],
  },
  {
    category: 'TIMINGS',
    question: 'What are your class timings?',
    answer: 'We run morning batches (6-7 AM), evening batches (5-7 PM), and weekend-only batches. Let us know your preferred time and we\'ll suggest the best batch for you!',
    keywords: ['timing', 'timings', 'schedule', 'hours', 'time', 'class time'],
  },
  {
    category: 'AGE_ELIGIBILITY',
    question: 'What age can my child join?',
    answer: 'We accept students from age 5 and up, with separate kids, teen, and adult batches so training is age-appropriate.',
    keywords: ['age', 'eligibility', 'eligible', 'old enough'],
  },
  {
    category: 'TRIAL_CLASS',
    question: 'Can we try a trial class first?',
    answer: 'Absolutely! We offer one free trial class so you can experience a session before enrolling. Reply "trial" and we\'ll help you pick a slot.',
    keywords: ['trial', 'demo', 'try a class', 'free class'],
  },
  {
    category: 'LOCATION',
    question: 'Where are you located?',
    answer: 'We\'re located in Bengaluru - message us here and we\'ll share the exact address and a map link.',
    keywords: ['location', 'address', 'located', 'directions'],
  },
  {
    category: 'CONTACT',
    question: 'How can I contact the academy?',
    answer: 'You can message us right here on WhatsApp anytime, or reply "talk to admin" to speak with our team directly.',
    keywords: ['contact', 'phone number', 'call you', 'reach you'],
  },
  {
    category: 'BELT_EXAM',
    question: 'When is the next belt exam?',
    answer: 'Belt exams are held every 3 months based on instructor recommendation. We\'ll announce the exact date to your batch in advance.',
    keywords: ['belt exam', 'grading', 'next belt', 'promotion test'],
  },
  {
    category: 'TOURNAMENT',
    question: 'Do you have tournaments?',
    answer: 'Yes! We regularly participate in and host tournaments. Announcements go out to all active students - keep an eye on your WhatsApp!',
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
    answer: 'Enrollment is simple - reply "trial" to book a free trial class first, and our team will guide you through admission right after.',
    keywords: ['admission', 'enroll', 'enrolment', 'sign up', 'join'],
  },
  {
    category: 'DOCUMENTS',
    question: 'What documents are needed for admission?',
    answer: 'Just a filled admission form and a copy of an ID/age proof for the student. We\'ll send you the admission form on request.',
    keywords: ['documents', 'documents required', 'id proof', 'paperwork'],
  },
  {
    category: 'UNIFORM',
    question: 'What uniform do I need to buy?',
    answer: 'A standard training uniform (gi) is required, available for purchase at the academy - approx ₹800. Belt color is assigned as you progress.',
    keywords: ['uniform', 'gi', 'dobok', 'kit'],
  },
];

async function main() {
  console.log('Clearing existing FAQs...');
  await prisma.faq.deleteMany();

  console.log(`Seeding ${faqs.length} FAQs...`);
  await prisma.faq.createMany({ data: faqs.map((f) => ({ ...f, active: true })) });

  console.log('Done. Seeded categories:', faqs.map((f) => f.category).join(', '));
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
