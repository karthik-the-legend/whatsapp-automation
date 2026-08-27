// apps/api/src/repositories/customer.repository.ts

import { prisma, CustomerProfile } from '@academy/db';

async function findByPhone(phone: string): Promise<CustomerProfile | null> {
  return prisma.customerProfile.findUnique({ where: { phone } });
}

async function create(phone: string): Promise<CustomerProfile> {
  return prisma.customerProfile.create({ data: { phone } });
}

/** Bumps lastContactAt/interactionCount - called once per inbound message, after the "is this their first contact" check has already read the prior state. */
async function recordContact(id: string): Promise<CustomerProfile> {
  return prisma.customerProfile.update({
    where: { id },
    data: { lastContactAt: new Date(), interactionCount: { increment: 1 } },
  });
}

async function updateName(id: string, name: string): Promise<CustomerProfile> {
  return prisma.customerProfile.update({ where: { id }, data: { name } });
}

export const customerRepository = { findByPhone, create, recordContact, updateName };
