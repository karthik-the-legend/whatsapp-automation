// apps/api/src/services/batch.service.ts

import { batchRepository } from '../repositories/batch.repository';
import { Prisma } from '@academy/db';

interface CreateBatchInput {
  name: string;
  daysOfWeek: number[];
  classStartTime: string; // "HH:mm"
  reminderOffsetMins?: number;
  feeAmount: number;
  feeCycle?: 'MONTHLY' | 'QUARTERLY';
  minAge?: number;
  maxAge?: number;
}

async function createBatch(input: CreateBatchInput) {
  return batchRepository.create({
    name: input.name,
    daysOfWeek: input.daysOfWeek,
    classStartTime: input.classStartTime,
    reminderOffsetMins: input.reminderOffsetMins ?? 60,
    feeAmount: input.feeAmount,
    feeCycle: input.feeCycle,
    minAge: input.minAge,
    maxAge: input.maxAge,
  });
}

async function updateBatch(id: string, data: Prisma.BatchUpdateInput) {
  return batchRepository.update(id, data);
}

async function deleteBatch(id: string) {
  return batchRepository.remove(id);
}

async function listBatches() {
  return batchRepository.findAll();
}

async function getBatch(id: string) {
  return batchRepository.findById(id);
}

export const batchService = { createBatch, updateBatch, deleteBatch, listBatches, getBatch };
