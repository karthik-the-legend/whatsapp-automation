// apps/api/src/schemas/attendance.schema.ts

import { z } from 'zod';

export const markAttendanceSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  batchId: z.string().min(1, 'batchId is required'),
  date: z.coerce.date(),
  status: z.enum(['PRESENT', 'ABSENT']),
  markedBy: z.string().optional(),
});

export const attendanceForDateQuerySchema = z.object({
  batchId: z.string().min(1, 'batchId is required'),
  date: z.coerce.date(),
});

export const attendanceSummaryQuerySchema = z.object({
  batchId: z.string().min(1, 'batchId is required'),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const churnRiskQuerySchema = z.object({
  batchId: z.string().min(1, 'batchId is required'),
  threshold: z.coerce.number().int().positive().optional(),
});
