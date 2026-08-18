// apps/api/src/repositories/admin.repository.ts

import { prisma, AdminRole } from '@academy/db';

async function findByClerkId(clerkId: string) {
  return prisma.adminUser.findUnique({ where: { clerkId } });
}

async function create(data: { clerkId: string; name: string; email: string; role?: AdminRole }) {
  return prisma.adminUser.create({ data });
}

export const adminRepository = { findByClerkId, create };
