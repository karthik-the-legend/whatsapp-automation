// apps/api/src/services/broadcast.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Covers spec item #8. Broadcasts MUST use Meta-approved template messages
// (not free-form text) because recipients are outside the 24-hour window -
// this is the one place in the codebase that's allowed to fan out a
// template to many recipients at once, and it's the only service that
// writes to BroadcastLog for the analytics/delivery-status view.
//
// IMPORTANT: segment resolution (which students match "pending fees",
// "belt level X", etc.) deliberately reuses the exact same repository
// queries as the rest of the app - there is no separate "broadcast
// audience" query path to keep in sync.

import { prisma, BroadcastSegment, Prisma } from '@academy/db';
import { studentRepository } from '../repositories/student.repository';
import { whatsappService } from './whatsapp.service';
import { logger } from '../config/logger';

const log = logger.child({ module: 'broadcast-service' });

interface BroadcastRequest {
  segment: BroadcastSegment;
  segmentFilter?: { batchId?: string; beltLevel?: string; minAge?: number; maxAge?: number };
  templateName: string;
  languageCode?: string;
  bodyPreview: string; // human-readable copy of the message, stored for the analytics/log view
  components?: Array<Record<string, unknown>>;
  createdBy?: string;
}

async function resolveAudience(segment: BroadcastSegment, filter: BroadcastRequest['segmentFilter'] = {}) {
  switch (segment) {
    case 'SPECIFIC_BATCH':
      if (!filter.batchId) throw new Error('batchId is required for SPECIFIC_BATCH broadcasts');
      return studentRepository.findByBatch(filter.batchId);

    case 'BELT_LEVEL':
      return prisma.student.findMany({ where: { beltLevel: filter.beltLevel, status: 'ACTIVE' } });

    case 'AGE_GROUP': {
      const where: Prisma.StudentWhereInput = { status: 'ACTIVE' };
      if (filter.minAge || filter.maxAge) {
        // Age is derived from dateOfBirth; a raw query keeps this simple for v1.
        const now = new Date();
        const minDob = filter.maxAge ? new Date(now.getFullYear() - filter.maxAge - 1, now.getMonth(), now.getDate()) : undefined;
        const maxDob = filter.minAge ? new Date(now.getFullYear() - filter.minAge, now.getMonth(), now.getDate()) : undefined;
        where.dateOfBirth = { ...(minDob ? { gte: minDob } : {}), ...(maxDob ? { lte: maxDob } : {}) };
      }
      return prisma.student.findMany({ where });
    }

    case 'PENDING_FEES':
      return studentRepository.findWithPendingFees();

    case 'ACTIVE_STUDENTS':
      return prisma.student.findMany({ where: { status: 'ACTIVE' } });

    case 'PARENTS_ONLY':
      // In this schema, phone == the parent/guardian's WhatsApp number for
      // kids' batches, so "parents only" and "active students" resolve to
      // the same audience today. Kept as a distinct case so a future
      // separate parentPhone field doesn't require touching call sites.
      return prisma.student.findMany({ where: { status: 'ACTIVE' } });

    case 'ALL_STUDENTS':
    default:
      return prisma.student.findMany();
  }
}

async function send(request: BroadcastRequest): Promise<{ sentCount: number; failedCount: number }> {
  const audience = await resolveAudience(request.segment, request.segmentFilter);

  let sentCount = 0;
  let failedCount = 0;

  for (const student of audience) {
    const result = await whatsappService.sendTemplate(
      student.phone,
      request.templateName,
      request.languageCode ?? 'en',
      request.components ?? [],
    );
    if (result.success) sentCount += 1;
    else failedCount += 1;
  }

  await prisma.broadcastLog.create({
    data: {
      segment: request.segment,
      segmentFilter: request.segmentFilter as Prisma.InputJsonValue,
      templateName: request.templateName,
      body: request.bodyPreview,
      sentCount,
      failedCount,
      createdBy: request.createdBy,
    },
  });

  log.info('Broadcast sent', { segment: request.segment, sentCount, failedCount });
  return { sentCount, failedCount };
}

export const broadcastService = { resolveAudience, send };
