// apps/api/src/receipts/receiptTemplate.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Per the stack rationale doc, receipts are HTML/CSS rendered to PDF via
// Puppeteer - no separate templating language to learn. This function
// returns the raw HTML string; pdfReceiptGenerator.ts is what actually
// launches the browser and prints it.

import { env } from '../config/env';

export interface ReceiptData {
  studentName: string;
  receiptNumber: string;
  paymentDate: Date;
  amountPaid: number; // in currency major units (e.g. rupees, not paise)
  paymentMode: string;
  batchName: string;
  remainingBalance: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

export function renderReceiptHtml(data: ReceiptData): string {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1a1a1a; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #c0392b; padding-bottom: 16px; margin-bottom: 24px; }
  .academy-name { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
  .receipt-title { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  td { padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }
  td.label { color: #666; width: 45%; }
  td.value { font-weight: 600; text-align: right; }
  .total-row td { font-size: 18px; border-bottom: none; padding-top: 16px; }
  .footer { margin-top: 40px; font-size: 12px; color: #999; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="academy-name">${env.ACADEMY_NAME}</div>
      <div class="receipt-title">Payment Receipt</div>
    </div>
    <div style="text-align:right; font-size:13px; color:#666;">
      Receipt #${data.receiptNumber}<br/>
      ${data.paymentDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
    </div>
  </div>

  <table>
    <tr><td class="label">Student Name</td><td class="value">${data.studentName}</td></tr>
    <tr><td class="label">Course / Batch</td><td class="value">${data.batchName}</td></tr>
    <tr><td class="label">Payment Mode</td><td class="value">${data.paymentMode}</td></tr>
    <tr class="total-row"><td class="label">Amount Paid</td><td class="value">${formatCurrency(data.amountPaid)}</td></tr>
    ${data.remainingBalance > 0 ? `<tr><td class="label">Remaining Balance</td><td class="value">${formatCurrency(data.remainingBalance)}</td></tr>` : ''}
  </table>

  <div class="footer">
    ${env.ACADEMY_NAME} · ${env.ACADEMY_CONTACT_PHONE || ''}<br/>
    This is a system-generated receipt.
  </div>
</body>
</html>`;
}
