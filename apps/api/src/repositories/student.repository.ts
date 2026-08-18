import { prisma, Student, Prisma } from '@academy/db';

async function create(
    data: Prisma.StudentCreateArgs['data']
): Promise<Student> {
    return prisma.student.create({ data });
}

async function update(
    id: string,
    data: Prisma.StudentUpdateArgs['data']
): Promise<Student> {
    return prisma.student.update({
        where: { id },
        data,
    });
}

async function remove(id: string): Promise<void> {
    await prisma.student.delete({
        where: { id },
    });
}

async function findById(id: string) {
    const studentId = String(id).trim();

    console.log('Searching for student:', studentId);

    const student = await prisma.student.findUnique({
        where: {
            id: studentId,
        },
        include: {
            batch: true,
            payments: true,
        },
    });

    console.log('Student found:', student ? student.id : null);

    return student;
}

async function findByPhone(phone: string) {
    return prisma.student.findUnique({
        where: { phone },
    });
}

async function search(query: {
    text?: string;
    batchId?: string;
    status?: Prisma.EnumStudentStatusFilter['equals'];
    page?: number;
    pageSize?: number;
}) {
    const {
        text,
        batchId,
        status,
        page = 1,
        pageSize = 25,
    } = query;

    const where: Prisma.StudentWhereInput = {
        ...(batchId ? { batchId } : {}),
        ...(status ? { status } : {}),
        ...(text
            ? {
                OR: [
                    { name: { contains: text, mode: 'insensitive' } },
                    { parentName: { contains: text, mode: 'insensitive' } },
                    { phone: { contains: text } },
                ],
            }
            : {}),
    };

    const [items, total] = await Promise.all([
        prisma.student.findMany({
            where,
            include: { batch: true },
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.student.count({ where }),
    ]);

    return { items, total, page, pageSize };
}

async function findWithPendingFees() {
    return prisma.student.findMany({
        where: {
            payments: {
                some: {
                    status: {
                        in: ['PENDING', 'OVERDUE', 'PARTIAL'],
                    },
                },
            },
        },
        include: {
            payments: true,
            batch: true,
        },
    });
}

async function findByBatch(batchId: string) {
    return prisma.student.findMany({
        where: {
            batchId,
            status: 'ACTIVE',
        },
    });
}

async function findBirthdaysOn(month: number, day: number) {
    return prisma.$queryRaw<Student[]>`
    SELECT * FROM "Student"
    WHERE EXTRACT(MONTH FROM "dateOfBirth") = ${month}
      AND EXTRACT(DAY FROM "dateOfBirth") = ${day}
      AND "status" = 'ACTIVE'
  `;
}

export const studentRepository = {
    create,
    update,
    remove,
    findById,
    findByPhone,
    search,
    findWithPendingFees,
    findByBatch,
    findBirthdaysOn,
};