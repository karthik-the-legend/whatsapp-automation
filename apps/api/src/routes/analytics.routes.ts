// apps/api/src/routes/analytics.routes.ts
//
// Thin per the architecture rule: validate -> call exactly one service
// method -> shape the response. All read-only - see
// services/analytics.service.ts for the actual aggregation queries.

import { FastifyInstance } from 'fastify';
import { analyticsService } from '../services/analytics.service';
import { validate } from '../utils/validate';
import {
  dailyEnquiriesQuerySchema,
  admissionsThisMonthQuerySchema,
  attendancePercentageQuerySchema,
  feeCollectionThisMonthQuerySchema,
  chatbotPerformanceQuerySchema,
  frequentlyAskedTopicsQuerySchema,
  broadcastDeliveryStatusQuerySchema,
  studentGrowthQuerySchema,
} from '../schemas/analytics.schema';

export async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/daily-enquiries', async (request, reply) => {
    const { date } = validate(dailyEnquiriesQuerySchema, request.query);
    const count = await analyticsService.dailyEnquiries(date);
    reply.send({ success: true, data: { count } });
  });

  fastify.get('/admissions-this-month', async (request, reply) => {
    const { reference } = validate(admissionsThisMonthQuerySchema, request.query);
    const count = await analyticsService.admissionsThisMonth(reference);
    reply.send({ success: true, data: { count } });
  });

  fastify.get('/attendance-percentage', async (request, reply) => {
    const { batchId, from, to } = validate(attendancePercentageQuerySchema, request.query);
    const percentage = await analyticsService.attendancePercentage(batchId, from, to);
    reply.send({ success: true, data: { percentage } });
  });

  fastify.get('/fee-collection-this-month', async (request, reply) => {
    const { reference } = validate(feeCollectionThisMonthQuerySchema, request.query);
    const amountPaid = await analyticsService.feeCollectionThisMonth(reference);
    reply.send({ success: true, data: { amountPaid } });
  });

  fastify.get('/outstanding-payments', async (_request, reply) => {
    const outstanding = await analyticsService.outstandingPayments();
    reply.send({ success: true, data: outstanding });
  });

  fastify.get('/chatbot-performance', async (request, reply) => {
    const { from, to } = validate(chatbotPerformanceQuerySchema, request.query);
    const performance = await analyticsService.chatbotPerformance(from, to);
    reply.send({ success: true, data: performance });
  });

  fastify.get('/frequently-asked-topics', async (request, reply) => {
    const { from, to, limit } = validate(frequentlyAskedTopicsQuerySchema, request.query);
    const topics = await analyticsService.frequentlyAskedTopics(from, to, limit);
    reply.send({ success: true, data: topics });
  });

  fastify.get('/broadcast-delivery-status', async (request, reply) => {
    const { limit } = validate(broadcastDeliveryStatusQuerySchema, request.query);
    const logs = await analyticsService.broadcastDeliveryStatus(limit);
    reply.send({ success: true, data: logs });
  });

  fastify.get('/student-growth', async (request, reply) => {
    const { months } = validate(studentGrowthQuerySchema, request.query);
    const growth = await analyticsService.studentGrowth(months);
    reply.send({ success: true, data: growth });
  });
}
