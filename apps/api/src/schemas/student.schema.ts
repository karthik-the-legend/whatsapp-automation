// apps/api/src/schemas/student.schema.ts

import { z } from 'zod';

export const createStudentSchema = z.object({
  name: z.string().min(1, 'name is required'),
  parentName: z.string().optional(),
  // Always normalize to a leading '+' here - same rule the webhook parser
  // uses (parsePayload.ts) - so phone lookups never miss due to formatting.
  phone: z.string().min(8, 'phone must be a valid WhatsApp number').transform((p) => (p.startsWith('+') ? p : `+${p}`)),
  altPhone: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  beltLevel: z.string().optional(),
  batchId: z.string().min(1).optional(),
  medicalNotes: z.string().optional(),
  sendWelcomeMessage: z.boolean().optional(),
});

export const updateStudentSchema = createStudentSchema.partial().omit({ sendWelcomeMessage: true });

export const searchStudentQuerySchema = z.object({
  text: z.string().optional(),
  batchId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TRIAL']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const assignBatchSchema = z.object({
  batchId: z.string().min(1, 'batchId is required'),
});
