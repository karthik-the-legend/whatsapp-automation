// apps/api/src/schemas/broadcast.schema.ts

import { z } from 'zod';

const segmentFilterSchema = z.object({
  batchId: z.string().optional(),
  beltLevel: z.string().optional(),
  minAge: z.number().int().nonnegative().optional(),
  maxAge: z.number().int().nonnegative().optional(),
});

export const sendBroadcastSchema = z.object({
  segment: z.enum(['SPECIFIC_BATCH', 'BELT_LEVEL', 'AGE_GROUP', 'PENDING_FEES', 'ACTIVE_STUDENTS', 'PARENTS_ONLY', 'ALL_STUDENTS']),
  segmentFilter: segmentFilterSchema.optional(),
  templateName: z.string().min(1, 'templateName is required'),
  languageCode: z.string().optional(),
  bodyPreview: z.string().min(1, 'bodyPreview is required'),
  components: z.array(z.record(z.unknown())).optional(),
  createdBy: z.string().optional(),
});

export const announceHolidaySchema = z.object({
  dateLabel: z.string().min(1, 'dateLabel is required'),
  reason: z.string().min(1, 'reason is required'),
  templateName: z.string().optional(),
});

export const announceClassCancellationSchema = z.object({
  batchId: z.string().min(1, 'batchId is required'),
  dateLabel: z.string().min(1, 'dateLabel is required'),
  reason: z.string().min(1, 'reason is required'),
  templateName: z.string().optional(),
});

export const announceScheduleChangeSchema = z.object({
  batchId: z.string().min(1, 'batchId is required'),
  newDetails: z.string().min(1, 'newDetails is required'),
  templateName: z.string().optional(),
});

export const announceTournamentSchema = z.object({
  details: z.string().min(1, 'details is required'),
  templateName: z.string().optional(),
  segment: z.enum(['ALL_STUDENTS', 'BELT_LEVEL']).optional(),
  beltLevel: z.string().optional(),
});

export const announceBeltExamSchema = z.object({
  batchId: z.string().min(1, 'batchId is required'),
  examDate: z.string().min(1, 'examDate is required'),
  templateName: z.string().optional(),
});

export const sendMonthlyMotivationSchema = z.object({
  templateName: z.string().optional(),
  message: z.string().optional(),
});

export const announceEventSchema = z.object({
  details: z.string().min(1, 'details is required'),
  templateName: z.string().optional(),
});
