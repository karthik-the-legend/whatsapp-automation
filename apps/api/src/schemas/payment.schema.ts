// apps/api/src/schemas/payment.schema.ts

import { z } from 'zod';

export const createPaymentSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  amount: z.number().int().positive('amount must be in smallest currency unit (paise)'),
  dueDate: z.coerce.date(),
});
