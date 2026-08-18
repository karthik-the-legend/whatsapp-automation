// apps/api/src/services/document.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Covers spec item #11. Sends pre-uploaded static documents (admission
// forms, syllabus, brochures) by their DocumentAsset record - documents
// are uploaded to Meta ONCE (via whatsappService.uploadMedia) and the
// resulting mediaId is cached on the DocumentAsset row, so repeat sends
// don't re-upload the same file.

import { prisma, DocumentType } from '@academy/db';
import { whatsappService } from './whatsapp.service';
import { logger } from '../config/logger';

const log = logger.child({ module: 'document-service' });

async function sendDocumentToStudent(phone: string, type: DocumentType): Promise<void> {
  const doc = await prisma.documentAsset.findFirst({ where: { type }, orderBy: { createdAt: 'desc' } });
  if (!doc) {
    log.warn('No document configured for type', { type });
    throw new Error(`No document of type ${type} has been uploaded yet - add one in the admin panel.`);
  }

  const result = await whatsappService.sendDocument(phone, {
    mediaId: doc.mediaId ?? undefined,
    link: doc.mediaId ? undefined : doc.fileUrl ?? undefined,
    filename: `${doc.name}.pdf`,
    caption: doc.name,
  });

  if (!result.success) {
    log.error('Failed to send document', { type, phone, error: result.error });
    throw new Error(`Failed to send document: ${result.error}`);
  }
}

/** Called from the admin panel upload flow - uploads once, caches the mediaId. */
async function registerDocument(name: string, type: DocumentType, fileBuffer: Buffer, filename: string, mimeType: string) {
  const mediaId = await whatsappService.uploadMedia(fileBuffer, filename, mimeType);
  return prisma.documentAsset.create({ data: { name, type, mediaId } });
}

async function listDocuments(type?: DocumentType) {
  return prisma.documentAsset.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: 'desc' },
  });
}

export const documentService = { sendDocumentToStudent, registerDocument, listDocuments };
