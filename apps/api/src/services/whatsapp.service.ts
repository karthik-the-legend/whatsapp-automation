// apps/api/src/services/whatsapp.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Every other service (receipts, reminders, chatbot, broadcasts) needs to
// send a WhatsApp message, but none of them should know about Graph API
// URLs, access tokens, or payload shapes. This is the single choke point
// for outbound WhatsApp traffic - it's also where you'd add rate limiting,
// retry/backoff, and send-logging once volume grows.
//
// NEVER call the Graph API directly from anywhere else in the codebase.

import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';

const log = logger.child({ module: 'whatsapp-service' });

const client: AxiosInstance = axios.create({
  baseURL: `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}`,
  headers: {
    Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
});

interface SendResult {
  success: boolean;
  waMessageId?: string;
  error?: string;
}

async function sendWithRetry(payload: Record<string, unknown>, attempt = 1): Promise<SendResult> {
  const MAX_ATTEMPTS = 3;
  try {
    const { data } = await client.post('/messages', payload);
    return { success: true, waMessageId: data?.messages?.[0]?.id };
  } catch (err: any) {
    const status = err?.response?.status;
    const retryable = status === 429 || status >= 500;

    log.warn('WhatsApp send failed', {
      attempt,
      status,
      error: err?.response?.data || err.message,
    });

    if (retryable && attempt < MAX_ATTEMPTS) {
      const backoffMs = 500 * 2 ** attempt; // exponential backoff
      await new Promise((r) => setTimeout(r, backoffMs));
      return sendWithRetry(payload, attempt + 1);
    }

    return { success: false, error: err?.response?.data?.error?.message || err.message };
  }
}

/** Plain text message. Only valid inside the 24-hour customer service window. */
async function sendText(to: string, body: string): Promise<SendResult> {
  return sendWithRetry({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body, preview_url: false },
  });
}

/**
 * Meta-approved template message. Required for anything sent outside the
 * 24-hour window (reminders, receipts triggered by a webhook, broadcasts).
 */
async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  components: Array<Record<string, unknown>> = [],
): Promise<SendResult> {
  return sendWithRetry({
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  });
}

/** Send a document (PDF receipt, admission form, syllabus, etc.) by media ID or link. */
async function sendDocument(
  to: string,
  opts: { mediaId?: string; link?: string; filename: string; caption?: string },
): Promise<SendResult> {
  return sendWithRetry({
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: {
      ...(opts.mediaId ? { id: opts.mediaId } : { link: opts.link }),
      filename: opts.filename,
      caption: opts.caption,
    },
  });
}

/** Interactive reply buttons - max 3 buttons, 20 chars each per Meta's limits. */
async function sendButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<SendResult> {
  return sendWithRetry({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
}

/** Interactive list menu - used for the main greeting menu (Timings/Fees/Trial/Human). */
async function sendList(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
): Promise<SendResult> {
  return sendWithRetry({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: { button: buttonText, sections },
    },
  });
}

/**
 * Uploads binary media (e.g. a generated receipt PDF) to Meta and returns
 * a media ID for use with sendDocument({ mediaId }). Required because
 * Meta's document endpoint needs either a public link or an uploaded
 * media ID - uploading avoids having to host generated PDFs publicly.
 */
async function uploadMedia(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', buffer, { filename, contentType: mimeType });

  const { data } = await client.post('/media', form, { headers: form.getHeaders() });
  return data.id;
}

async function markAsRead(waMessageId: string): Promise<void> {
  try {
    await client.post('/messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: waMessageId,
    });
  } catch (err: any) {
    log.warn('Failed to mark message as read', { waMessageId, error: err.message });
  }
}

export const whatsappService = {
  sendText,
  sendTemplate,
  sendDocument,
  sendButtons,
  sendList,
  uploadMedia,
  markAsRead,
};
