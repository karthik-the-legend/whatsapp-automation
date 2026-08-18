// apps/api/src/routes/payment.routes.ts

import { FastifyInstance } from 'fastify';
import { paymentService } from '../services/payment.service';
import { validate } from '../utils/validate';
import { createPaymentSchema } from '../schemas/payment.schema';
import { ApiError } from '../plugins/errorHandler.plugin';

interface IdParam {
  Params: { id: string };
}

export async function paymentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/', async (request, reply) => {
    const data = validate(createPaymentSchema, request.body);
    const payment = await paymentService.createPendingPayment(data);
    reply.status(201).send({ success: true, data: payment });
  });

  fastify.get<IdParam>('/:id', async (request, reply) => {
    const payment = await paymentService.getPayment(request.params.id);
    if (!payment) throw new ApiError(404, 'Payment not found');
    reply.send({ success: true, data: payment });
  });
}
