// apps/api/src/routes/batch.routes.ts

import { FastifyInstance } from 'fastify';
import { batchService } from '../services/batch.service';
import { validate } from '../utils/validate';
import { createBatchSchema, updateBatchSchema } from '../schemas/batch.schema';
import { ApiError } from '../plugins/errorHandler.plugin';

interface IdParam {
  Params: { id: string };
}

export async function batchRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/', async (request, reply) => {
    const data = validate(createBatchSchema, request.body);
    const batch = await batchService.createBatch(data);
    reply.status(201).send({ success: true, data: batch });
  });

  fastify.get('/', async (_request, reply) => {
    const batches = await batchService.listBatches();
    reply.send({ success: true, data: batches });
  });

  fastify.get<IdParam>('/:id', async (request, reply) => {
    const batch = await batchService.getBatch(request.params.id);
    if (!batch) throw new ApiError(404, 'Batch not found');
    reply.send({ success: true, data: batch });
  });

  fastify.patch<IdParam>('/:id', async (request, reply) => {
    const data = validate(updateBatchSchema, request.body);
    const batch = await batchService.updateBatch(request.params.id, data);
    reply.send({ success: true, data: batch });
  });

  fastify.delete<IdParam>('/:id', async (request, reply) => {
    await batchService.deleteBatch(request.params.id);
    reply.status(204).send();
  });
}
