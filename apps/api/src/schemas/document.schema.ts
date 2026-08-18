// apps/api/src/schemas/document.schema.ts

import { z } from 'zod';

const documentTypeEnum = z.enum([
  'ADMISSION_FORM',
  'ACADEMY_RULES',
  'FEE_STRUCTURE',
  'UNIFORM_INFO',
  'BELT_SYLLABUS',
  'EVENT_BROCHURE',
  'TOURNAMENT_FORM',
  'TRAINING_SCHEDULE',
]);

// Validates the plain text fields sent alongside the file in the
// multipart body - the file itself is handled separately by
// @fastify/multipart (see routes/document.routes.ts), Zod has no useful
// way to validate a file stream/buffer.
export const registerDocumentFieldsSchema = z.object({
  name: z.string().min(1, 'name is required'),
  type: documentTypeEnum,
});

export const sendDocumentSchema = z.object({
  phone: z.string().min(8, 'phone must be a valid WhatsApp number').transform((p) => (p.startsWith('+') ? p : `+${p}`)),
  type: documentTypeEnum,
});

export const listDocumentsQuerySchema = z.object({
  type: documentTypeEnum.optional(),
});
