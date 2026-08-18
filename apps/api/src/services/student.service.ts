// apps/api/src/services/student.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Backs spec item #6 (Student Database) and the student-management part
// of item #7 (Admin Dashboard). Thin orchestration over
// studentRepository, plus the one business rule that doesn't belong in
// the repository: sending the welcome message on creation.

import { studentRepository } from '../repositories/student.repository';
import { communicationService } from './communication.service';
import { logger } from '../config/logger';

const log = logger.child({ module: 'student-service' });

interface CreateStudentInput {
  name: string;
  parentName?: string;
  phone: string;
  altPhone?: string;
  dateOfBirth?: Date;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  beltLevel?: string;
  batchId?: string;
  medicalNotes?: string;
  sendWelcomeMessage?: boolean;
}

async function createStudent(input: CreateStudentInput) {
  const existing = await studentRepository.findByPhone(input.phone);
  if (existing) {
    throw new Error(`A student with phone ${input.phone} already exists.`);
  }

  const student = await studentRepository.create({
        name: input.name,
        parentName: input.parentName,
        phone: input.phone,
        altPhone: input.altPhone,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        beltLevel: input.beltLevel,
        medicalNotes: input.medicalNotes,

        ...(input.batchId ? { batchId: input.batchId } : {}),
  });

  if (input.sendWelcomeMessage !== false) {
    await communicationService.sendWelcomeMessage(student.id).catch((err) => {
      // Welcome message failure should never block student creation.
      log.warn('Welcome message failed to send', { studentId: student.id, error: err.message });
    });
  }

  return student;
}

async function updateStudent(
    id: string,
    input: Partial<Omit<CreateStudentInput, 'sendWelcomeMessage'>>
) {
    const { batchId, ...rest } = input;

    return studentRepository.update(id, {
        ...rest,
        ...(batchId ? { batchId } : {}),
    });
}

async function deleteStudent(id: string) {
  return studentRepository.remove(id);
}

async function assignToBatch(studentId: string, batchId: string) {
  return studentRepository.update(studentId, { batch: { connect: { id: batchId } } });
}

async function getStudent(id: string) {
    console.log('Service id =', id);

    const student = await studentRepository.findById(id);

    console.log('Service result =', student);

    return student;
}

async function searchStudents(params: { text?: string; batchId?: string; status?: any; page?: number; pageSize?: number }) {
  return studentRepository.search(params);
}

async function paymentHistory(studentId: string) {
  const { paymentRepository } = await import('../repositories/payment.repository');
  return paymentRepository.findHistoryForStudent(studentId);
}

export const studentService = {
  createStudent,
  updateStudent,
  deleteStudent,
  assignToBatch,
  getStudent,
  searchStudents,
  paymentHistory,
};
