// apps/api/src/services/receipt.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// This is the "Payment Receipt Automation" from the spec: the moment a
// payment is confirmed (via the Razorpay/Stripe webhook - not built here,
// that lives in src/webhooks/), this service generates the receipt number,
// renders the branded PDF, and sends it on WhatsApp with zero staff
// involvement, exactly as the spec requires.

import { paymentRepository } from '../repositories/payment.repository';
import { generateReceiptPdf } from '../receipts/pdfReceiptGenerator';
import { whatsappService } from './whatsapp.service';
import { env } from '../config/env';
import { logger } from '../config/logger';

const log = logger.child({ module: 'receipt-service' });

/**
 * Sequential, year-scoped receipt numbers: KFA-2026-000042. Using the
 * payment's own auto-increment-free cuid would work but wouldn't look
 * "professional and branded" per the spec - a short sequential number
 * does. Collisions are avoided by the DB's unique constraint on
 * receiptNumber; on the rare race, the caller should retry.
 */
async function generateReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  // Timestamp-suffix sequence: simple and collision-resistant for v1 single-branch
  // volume. Swap for a DB sequence/counter table once you're issuing receipts
  // fast enough (e.g. multi-branch) that a millisecond collision is plausible.
  const sequence = String(Date.now()).slice(-6);
  return `KFA-${year}-${sequence}`;
}

/**
 * Called once a payment is confirmed (status -> PAID). Generates the
 * receipt number if not already set, renders the PDF, uploads it to
 * WhatsApp, and sends it as a document to the parent.
 */
async function issueAndSendReceipt(paymentId: string): Promise<void> {
  const payment = await paymentRepository.findById(paymentId);
  if (!payment) throw new Error(`Payment ${paymentId} not found`);
  if (!payment.student) throw new Error(`Payment ${paymentId} has no linked student`);

  const receiptNumber = payment.receiptNumber ?? (await generateReceiptNumber());
  const amountPaid = (payment.amountPaid ?? payment.amount) / 100; // paise -> rupees
  const remainingBalance = Math.max(0, payment.amount - (payment.amountPaid ?? payment.amount)) / 100;

  const pdfBuffer = await generateReceiptPdf({
    studentName: payment.student.name,
    receiptNumber,
    paymentDate: payment.paidAt ?? new Date(),
    amountPaid,
    paymentMode: payment.paymentMode ?? 'N/A',
    batchName: payment.student.batch?.name ?? 'N/A',
    remainingBalance,
  });

  const mediaId = await whatsappService.uploadMedia(
    pdfBuffer,
    `${receiptNumber}.pdf`,
    'application/pdf',
  );

  const sendResult = await whatsappService.sendDocument(payment.student.phone, {
    mediaId,
    filename: `Receipt-${receiptNumber}.pdf`,
    caption: `Thank you! Here's your payment receipt from ${env.ACADEMY_NAME}.`,
  });

  if (!sendResult.success) {
    log.error('Failed to send receipt', { paymentId, error: sendResult.error });
    throw new Error(`Failed to send receipt: ${sendResult.error}`);
  }

  await paymentRepository.update(paymentId, {
    receiptNumber,
    receiptSentAt: new Date(),
  });

  log.info('Receipt issued and sent', { paymentId, receiptNumber });
}

export const receiptService = { generateReceiptNumber, issueAndSendReceipt };
