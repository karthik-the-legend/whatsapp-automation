// apps/api/src/routes/document.routes.ts
//
// Thin per the architecture rule: validate -> call exactly one service
// method -> shape the response. No business logic lives here - see
// services/document.service.ts for that.
//
// The upload route is the one place in the codebase handling
// multipart/form-data (via @fastify/multipart, registered in app.ts) -
// every other route is plain JSON.

import { FastifyInstance } from 'fastify';
import { documentService } from '../services/document.service';
import { validate } from '../utils/validate';
import { registerDocumentFieldsSchema, sendDocumentSchema, listDocumentsQuerySchema } from '../schemas/document.schema';
import { ApiError } from '../plugins/errorHandler.plugin';

function fieldValue(fields: Record<string, unknown>, key: string): unknown {
  const field = fields[key] as { value?: unknown } | undefined;
  return field?.value;
}

export async function documentRoutes(fastify: FastifyInstance): Promise<void> {
  // multipart/form-data: the file under field "file", plus "name" and
  // "type" as regular text fields in the same form.
  fastify.post('/', async (request, reply) => {
    const file = await request.file();
    if (!file) throw new ApiError(400, 'A file is required (multipart field "file")');

    const { name, type } = validate(registerDocumentFieldsSchema, {
      name: fieldValue(file.fields, 'name'),
      type: fieldValue(file.fields, 'type'),
    });

    const buffer = await file.toBuffer();
    const document = await documentService.registerDocument(name, type, buffer, file.filename, file.mimetype);
    reply.status(201).send({ success: true, data: document });
  });

  fastify.get('/', async (request, reply) => {
    const { type } = validate(listDocumentsQuerySchema, request.query);
    const documents = await documentService.listDocuments(type);
    reply.send({ success: true, data: documents });
  });

  fastify.post('/send', async (request, reply) => {
    const { phone, type } = validate(sendDocumentSchema, request.body);
    await documentService.sendDocumentToStudent(phone, type);
    reply.status(201).send({ success: true });
  });
}
