// apps/api/src/services/adminAuth.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Covers spec item #14 (Admin Auth). Clerk is the identity provider (it
// verifies "is this a real, logged-in person"), but AdminUser is the
// source of truth for "is this person allowed to touch academy data, and
// with what role". Deliberately does NOT auto-provision an AdminUser row
// for any valid Clerk session - anyone who signs up on the academy's
// Clerk instance would otherwise get instant admin access. The first
// OWNER (and every admin after) is created explicitly via
// `npm run admin:create` once you know their Clerk user ID.

import { adminRepository } from '../repositories/admin.repository';

async function findByClerkId(clerkId: string) {
  return adminRepository.findByClerkId(clerkId);
}

export const adminAuthService = { findByClerkId };
