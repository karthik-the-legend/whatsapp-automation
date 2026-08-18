// apps/api/src/receipts/pdfReceiptGenerator.ts

import puppeteer from 'puppeteer';
import { renderReceiptHtml, ReceiptData } from './receiptTemplate';

/**
 * Renders the receipt HTML to a PDF buffer. Reuses a single browser
 * instance across calls (launching Chromium per-request would be far too
 * slow for a webhook-triggered flow) - see the shared `browserPromise`.
 */
let browserPromise: ReturnType<typeof puppeteer.launch> | null = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }
  return browserPromise;
}

export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(renderReceiptHtml(data), { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px' } });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
