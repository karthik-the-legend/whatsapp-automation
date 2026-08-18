// apps/api/src/routes/attendance.routes.ts
//
// Thin per the architecture rule: validate -> call exactly one service
// method -> shape the response. No business logic lives here - see
// services/attendance.service.ts for that.

import { FastifyInstance } from 'fastify';
import { attendanceService } from '../services/attendance.service';
import { validate } from '../utils/validate';
import {
  markAttendanceSchema,
  attendanceForDateQuerySchema,
  attendanceSummaryQuerySchema,
  churnRiskQuerySchema,
} from '../schemas/attendance.schema';

export async function attendanceRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/', async (request, reply) => {
    const { studentId, batchId, date, status, markedBy } = validate(markAttendanceSchema, request.body);
    const record = await attendanceService.mark(studentId, batchId, date, status, markedBy);
    reply.status(201).send({ success: true, data: record });
  });

  fastify.get('/', async (request, reply) => {
    const { batchId, date } = validate(attendanceForDateQuerySchema, request.query);
    const records = await attendanceService.getForDate(batchId, date);
    reply.send({ success: true, data: records });
  });

  fastify.get('/summary', async (request, reply) => {
    const { batchId, from, to } = validate(attendanceSummaryQuerySchema, request.query);
    const summary = await attendanceService.weeklySummary(batchId, from, to);
    reply.send({ success: true, data: summary });
  });

  fastify.get('/churn-risk', async (request, reply) => {
    const { batchId, threshold } = validate(churnRiskQuerySchema, request.query);
    const studentIds = await attendanceService.churnRiskForBatch(batchId, threshold);
    reply.send({ success: true, data: studentIds });
  });
}
