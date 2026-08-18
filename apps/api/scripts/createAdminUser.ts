// apps/api/scripts/createAdminUser.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// clerkAuth.plugin.ts deliberately refuses to auto-provision an AdminUser
// row for any valid Clerk session (see adminAuth.service.ts for why) -
// so the first admin (and every one after) has to be created explicitly,
// once you know their Clerk user ID. Get that ID from the Clerk Dashboard
// (Users -> click the user -> the "user_..." ID at the top) after they've
// signed up once on your Clerk instance.
//
// Usage (from apps/api):
//   npx tsx scripts/createAdminUser.ts <clerkUserId> <name> <email> [OWNER|INSTRUCTOR|FRONT_DESK]

import { adminRepository } from '../src/repositories/admin.repository';
import { prisma, AdminRole } from '@academy/db';

const [, , clerkId, name, email, roleArg] = process.argv;
const VALID_ROLES: AdminRole[] = ['OWNER', 'INSTRUCTOR', 'FRONT_DESK'];

async function main() {
  if (!clerkId || !name || !email) {
    console.error('Usage: npx tsx scripts/createAdminUser.ts <clerkUserId> <name> <email> [OWNER|INSTRUCTOR|FRONT_DESK]');
    process.exit(1);
  }

  const role = (roleArg as AdminRole) ?? 'OWNER';
  if (!VALID_ROLES.includes(role)) {
    console.error(`role must be one of: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  const admin = await adminRepository.create({ clerkId, name, email, role });
  console.log('Created admin user:', admin);
  console.log('\nThey can now call any /api/v1/* endpoint with "Authorization: Bearer <their Clerk session token>".');
}

main()
  .catch((err) => {
    console.error('Failed to create admin user:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
