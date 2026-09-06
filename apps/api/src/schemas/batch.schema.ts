// apps/api/src/schemas/batch.schema.ts

import { z } from 'zod';

export const createBatchSchema = z.object({
  name: z.string().min(1, 'name is required'),
  branch: z.string().min(1).optional(), // "Main Branch" or "ADON Institute" - defaults to "Main Branch" in the DB
  category: z.enum(['KUNG_FU', 'SENIOR', 'DANCE']).optional(),
  audience: z.string().optional(), // e.g. "Children", "Adults", "Men & Ladies" - only set when actually verified, never guessed
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, 'at least one day is required'),
  classStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'classStartTime must be 24-hour HH:mm, e.g. "17:00"'),
  classEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'classEndTime must be 24-hour HH:mm, e.g. "18:00"')
    .optional(),
  reminderOffsetMins: z.number().int().positive().optional(),
  // Nullable/optional - only ever set from a verified figure (see
  // FEE_PROFILES in businessQuery.service.ts), never guessed.
  feeAmount: z.number().int().positive('feeAmount must be in smallest currency unit, e.g. paise').optional(),
  feeCycle: z.enum(['MONTHLY', 'QUARTERLY']).optional(),
  minAge: z.number().int().nonnegative().optional(),
  maxAge: z.number().int().nonnegative().optional(),
});

export const updateBatchSchema = createBatchSchema.partial();
