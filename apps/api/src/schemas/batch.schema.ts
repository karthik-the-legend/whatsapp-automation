// apps/api/src/schemas/batch.schema.ts

import { z } from 'zod';

export const createBatchSchema = z.object({
  name: z.string().min(1, 'name is required'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, 'at least one day is required'),
  classStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'classStartTime must be 24-hour HH:mm, e.g. "17:00"'),
  reminderOffsetMins: z.number().int().positive().optional(),
  feeAmount: z.number().int().positive('feeAmount must be in smallest currency unit, e.g. paise'),
  feeCycle: z.enum(['MONTHLY', 'QUARTERLY']).optional(),
  minAge: z.number().int().nonnegative().optional(),
  maxAge: z.number().int().nonnegative().optional(),
});

export const updateBatchSchema = createBatchSchema.partial();
