// apps/api/src/services/payment.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Two responsibilities that belong together: creating a "fee due" record
// (with a real or mock Razorpay order attached), and processing the
// webhook confirmation once that order is actually paid. Kept in one file
// because they share the same Payment lifecycle - splitting them would
// mean duplicating the idempotency and status-transition logic.

import { paymentRepository } from '../repositories/payment.repository';
import { studentRepository } from '../repositories/student.repository';
import { receiptService } from './receipt.service';
import { getRazorpayClient } from '../config/razorpay';
import { ApiError } from '../plugins/errorHandler.plugin';
import { logger } from '../config/logger';
import { PaymentMode } from '@academy/db';

const log = logger.child({ module: 'payment-service' });

interface CreatePendingPaymentInput {
  studentId: string;
  amount: number; // paise
  dueDate: Date;
}

async function createPendingPayment(input: CreatePendingPaymentInput) {
  const student = await studentRepository.findById(input.studentId);
  if (!student) throw new ApiError(404, `Student ${input.studentId} not found`);

  const razorpay = getRazorpayClient();
  let gatewayOrderId: string;

  if (razorpay) {
    const order = await razorpay.orders.create({
      amount: input.amount,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    });
    gatewayOrderId = String(order.id);
  } else {
    // No real Razorpay credentials configured yet - generate a mock order
    // id so the local webhook simulator (scripts/sendTestPaymentWebhook.ts)
    // has something real to reference. Set RAZORPAY_KEY_ID/SECRET in .env
    // once you have a real account and this branch stops being used.
    gatewayOrderId = `order_test_${Date.now()}`;
    log.warn('Razorpay not configured - created payment with a mock order id (dev/testing only)', { gatewayOrderId });
  }

  return paymentRepository.create({
    student: { connect: { id: input.studentId } },
    amount: input.amount,
    dueDate: input.dueDate,
    gatewayOrderId,
  });
}

async function getPayment(id: string) {
  return paymentRepository.findById(id);
}

const PAYMENT_MODE_MAP: Record<string, PaymentMode> = {
  upi: 'UPI',
  card: 'CARD',
  netbanking: 'BANK_TRANSFER',
  wallet: 'RAZORPAY',
};

interface PaymentCapturedEvent {
  orderId: string;
  gatewayPaymentId: string;
  amountPaid: number;
  method?: string;
}

/**
 * Called by the Razorpay webhook route once a signature-verified
 * "payment.captured" event arrives. Idempotent by design: Razorpay retries
 * webhook delivery on any non-2xx response, and even a correctly-acked
 * webhook can occasionally be redelivered - reprocessing an already-PAID
 * payment must be a safe no-op, not a duplicate receipt.
 */
async function handleRazorpayPaymentCaptured(event: PaymentCapturedEvent): Promise<void> {
  const payment = await paymentRepository.findByGatewayOrderId(event.orderId);
  if (!payment) {
    log.warn('Received payment.captured for unknown order - ignoring', { orderId: event.orderId });
    return;
  }

  if (payment.status === 'PAID') {
    log.info('Duplicate payment.captured webhook - already processed, skipping', { paymentId: payment.id });
    return;
  }

  await paymentRepository.update(payment.id, {
    status: 'PAID',
    amountPaid: event.amountPaid,
    paymentMode: (event.method && PAYMENT_MODE_MAP[event.method]) || 'RAZORPAY',
    paidAt: new Date(),
    gatewayPaymentId: event.gatewayPaymentId,
  });

  log.info('Payment marked PAID', { paymentId: payment.id, amountPaid: event.amountPaid });

  try {
    await receiptService.issueAndSendReceipt(payment.id);
  } catch (err: any) {
    // The payment itself is correctly recorded regardless of whether the
    // WhatsApp receipt send succeeded (e.g. no real WhatsApp credentials
    // configured yet). A delivery failure must never make it look like
    // the PAYMENT failed - that's a financially incorrect state. Resending
    // the receipt is a manual admin action for now (future feature).
    log.error('Payment recorded but receipt send failed', { paymentId: payment.id, error: err.message });
  }
}

async function handleRazorpayPaymentFailed(orderId: string): Promise<void> {
  const payment = await paymentRepository.findByGatewayOrderId(orderId);
  if (!payment) return;

  await paymentRepository.update(payment.id, { status: 'FAILED' });
  log.info('Payment marked FAILED', { paymentId: payment.id });
}

export const paymentService = {
  createPendingPayment,
  getPayment,
  handleRazorpayPaymentCaptured,
  handleRazorpayPaymentFailed,
};
