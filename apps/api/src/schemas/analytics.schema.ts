// apps/api/src/schemas/analytics.schema.ts

import { z } from 'zod';

export const dailyEnquiriesQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

export const admissionsThisMonthQuerySchema = z.object({
  reference: z.coerce.date().optional(),
});

export const attendancePercentageQuerySchema = z.object({
  batchId: z.string().min(1, 'batchId is required'),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const feeCollectionThisMonthQuerySchema = z.object({
  reference: z.coerce.date().optional(),
});

export const chatbotPerformanceQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const frequentlyAskedTopicsQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const broadcastDeliveryStatusQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const studentGrowthQuerySchema = z.object({
  months: z.coerce.number().int().positive().max(36).optional(),
});
