// apps/api/src/repositories/batch.repository.ts

import { prisma, Batch, Prisma } from '@academy/db';

async function create(data: Prisma.BatchCreateInput): Promise<Batch> {
  return prisma.batch.create({ data });
}

async function update(id: string, data: Prisma.BatchUpdateInput): Promise<Batch> {
  return prisma.batch.update({ where: { id }, data });
}

async function remove(id: string): Promise<void> {
  await prisma.batch.delete({ where: { id } });
}

async function findAll() {
  return prisma.batch.findMany({ orderBy: { name: 'asc' } });
}

async function findById(id: string) {
  return prisma.batch.findUnique({ where: { id }, include: { students: true } });
}

/** Batches that run today, for the class-reminder job (Green Belt). */
async function findRunningOnDay(dayOfWeek: number) {
  return prisma.batch.findMany({ where: { daysOfWeek: { has: dayOfWeek } } });
}

export const batchRepository = { create, update, remove, findAll, findById, findRunningOnDay };
