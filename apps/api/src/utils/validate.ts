// apps/api/src/utils/validate.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// One tiny helper so every route validates the same way: parse with a Zod
// schema, throw a 400 ApiError with the exact field errors on failure.
// Routes call `validate(schema, request.body)` and get back a fully
// typed, already-validated object - no route hand-rolls its own
// if-statements checking `typeof body.name === 'string'`.

import { ZodSchema } from 'zod';
import { ApiError } from '../plugins/errorHandler.plugin';

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(400, 'Validation failed', result.error.flatten());
  }
  return result.data;
}
