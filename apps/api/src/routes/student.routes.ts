// apps/api/src/routes/student.routes.ts
//
// Thin per the architecture rule: validate -> call exactly one service
// method -> shape the response. No business logic lives here - see
// services/student.service.ts for that.


import { FastifyInstance } from 'fastify';
import { studentService } from '../services/student.service';
import { validate } from '../utils/validate';
import { createStudentSchema, updateStudentSchema, searchStudentQuerySchema, assignBatchSchema } from '../schemas/student.schema';
import { ApiError } from '../plugins/errorHandler.plugin';

interface IdParam {
  Params: { id: string };
}

export async function studentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/', async (request, reply) => {
    const data = validate(createStudentSchema, request.body);
    const student = await studentService.createStudent(data);
    reply.status(201).send({ success: true, data: student });
  });

  fastify.get('/', async (request, reply) => {
    const query = validate(searchStudentQuerySchema, request.query);
    const result = await studentService.searchStudents(query);
    reply.send({ success: true, data: result });
  });

    fastify.get<IdParam>('/:id', async (request, reply) => {
        console.log('Route param id =', request.params.id);

        const student = await studentService.getStudent(request.params.id);

        console.log('Repository result =', student);

        if (!student) throw new ApiError(404, 'Student not found');

        reply.send({ success: true, data: student });
    });

  fastify.patch<IdParam>('/:id', async (request, reply) => {
    const data = validate(updateStudentSchema, request.body);
    const student = await studentService.updateStudent(request.params.id, data);
    reply.send({ success: true, data: student });
  });

  fastify.delete<IdParam>('/:id', async (request, reply) => {
    await studentService.deleteStudent(request.params.id);
    reply.status(204).send();
  });

  fastify.post<IdParam>('/:id/assign-batch', async (request, reply) => {
    const { batchId } = validate(assignBatchSchema, request.body);
    const student = await studentService.assignToBatch(request.params.id, batchId);
    reply.send({ success: true, data: student });
  });

  fastify.get<IdParam>('/:id/payments', async (request, reply) => {
    const payments = await studentService.paymentHistory(request.params.id);
    reply.send({ success: true, data: payments });
  });
}
