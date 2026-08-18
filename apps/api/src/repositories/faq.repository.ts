// apps/api/src/repositories/faq.repository.ts

import { prisma, Faq, Prisma, FaqCategory } from '@academy/db';

async function create(data: Prisma.FaqCreateInput): Promise<Faq> {
  return prisma.faq.create({ data });
}

async function update(id: string, data: Prisma.FaqUpdateInput): Promise<Faq> {
  return prisma.faq.update({ where: { id }, data });
}

async function remove(id: string): Promise<void> {
  await prisma.faq.delete({ where: { id } });
}

async function findAllActive() {
  return prisma.faq.findMany({ where: { active: true } });
}

async function findByCategory(category: FaqCategory) {
  return prisma.faq.findMany({ where: { category, active: true } });
}

export const faqRepository = { create, update, remove, findAllActive, findByCategory };
