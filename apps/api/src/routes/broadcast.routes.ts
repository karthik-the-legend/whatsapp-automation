// apps/api/src/routes/broadcast.routes.ts
//
// Thin per the architecture rule: validate -> call exactly one service
// method -> shape the response. No business logic lives here - see
// services/broadcast.service.ts and services/communication.service.ts.

import { FastifyInstance } from 'fastify';
import { broadcastService } from '../services/broadcast.service';
import { communicationService } from '../services/communication.service';
import { validate } from '../utils/validate';
import {
  sendBroadcastSchema,
  announceHolidaySchema,
  announceClassCancellationSchema,
  announceScheduleChangeSchema,
  announceTournamentSchema,
  announceBeltExamSchema,
  sendMonthlyMotivationSchema,
  announceEventSchema,
} from '../schemas/broadcast.schema';

export async function broadcastRoutes(fastify: FastifyInstance): Promise<void> {
  // Generic, fully custom segment broadcast.
  fastify.post('/', async (request, reply) => {
    const data = validate(sendBroadcastSchema, request.body);
    const result = await broadcastService.send(data);
    reply.status(201).send({ success: true, data: result });
  });

  // Preset announcement shapes - thin wrappers over communicationService,
  // each already picking the right segment/template on the service side.
  fastify.post('/holiday', async (request, reply) => {
    const { dateLabel, reason, templateName } = validate(announceHolidaySchema, request.body);
    await communicationService.announceHoliday(dateLabel, reason, templateName);
    reply.status(201).send({ success: true });
  });

  fastify.post('/class-cancellation', async (request, reply) => {
    const { batchId, dateLabel, reason, templateName } = validate(announceClassCancellationSchema, request.body);
    await communicationService.announceClassCancellation(batchId, dateLabel, reason, templateName);
    reply.status(201).send({ success: true });
  });

  fastify.post('/schedule-change', async (request, reply) => {
    const { batchId, newDetails, templateName } = validate(announceScheduleChangeSchema, request.body);
    await communicationService.announceScheduleChange(batchId, newDetails, templateName);
    reply.status(201).send({ success: true });
  });

  fastify.post('/tournament', async (request, reply) => {
    const { details, templateName, segment, beltLevel } = validate(announceTournamentSchema, request.body);
    await communicationService.announceTournament(details, templateName, segment, beltLevel);
    reply.status(201).send({ success: true });
  });

  fastify.post('/belt-exam', async (request, reply) => {
    const { batchId, examDate, templateName } = validate(announceBeltExamSchema, request.body);
    await communicationService.announceBeltExam(batchId, examDate, templateName);
    reply.status(201).send({ success: true });
  });

  fastify.post('/monthly-motivation', async (request, reply) => {
    const { templateName, message } = validate(sendMonthlyMotivationSchema, request.body);
    await communicationService.sendMonthlyMotivation(templateName, message);
    reply.status(201).send({ success: true });
  });

  fastify.post('/event', async (request, reply) => {
    const { details, templateName } = validate(announceEventSchema, request.body);
    await communicationService.announceEvent(details, templateName);
    reply.status(201).send({ success: true });
  });
}
