// apps/api/src/routes/conversation.routes.ts
//
// Thin per the architecture rule: validate -> call exactly one service
// method -> shape the response. See services/conversation.service.ts for
// why this exists - it's the previously-missing admin capability to
// actually resolve an escalated conversation.

import { FastifyInstance } from 'fastify';
import { conversationService } from '../services/conversation.service';

interface IdParam {
  Params: { id: string };
}

export async function conversationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/escalated', async (_request, reply) => {
    const conversations = await conversationService.listEscalated();
    reply.send({ success: true, data: conversations });
  });

  fastify.post<IdParam>('/:id/resolve', async (request, reply) => {
    const conversation = await conversationService.resolve(request.params.id);
    reply.send({ success: true, data: conversation });
  });
}
