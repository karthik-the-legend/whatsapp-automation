// apps/api/src/webhooks/parsePayload.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Meta's webhook payload is deeply nested (entry[].changes[].value...) and
// carries several unrelated event types in the same shape - inbound
// messages, delivery/read status updates, and others. Isolating the
// parsing here means the route file stays about HTTP concerns and
// whatsapp.webhook.ts stays about business orchestration; neither has to
// know Meta's exact JSON structure.

interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          text?: { body: string };
        }>;
        statuses?: Array<{ id: string; status: string; recipient_id: string }>;
      };
    }>;
  }>;
}

export interface ParsedInboundMessage {
  from: string;
  waMessageId: string;
  text: string;
}

export interface ParsedStatusUpdate {
  waMessageId: string;
  status: string;
  recipientId: string;
}

export interface ParsedWebhookEvent {
  messages: ParsedInboundMessage[];
  statuses: ParsedStatusUpdate[];
}

/**
 * Meta always uses E.164 digits without a leading '+' in the `from` field
 * (e.g. "919876543210"). We normalize to a leading '+' here, once, so
 * every downstream repository/service can rely on consistent E.164
 * formatting for phone lookups.
 */
function normalizePhone(rawPhone: string): string {
  return rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;
}

export function parseWebhookPayload(payload: MetaWebhookPayload): ParsedWebhookEvent {
  const messages: ParsedInboundMessage[] = [];
  const statuses: ParsedStatusUpdate[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      for (const msg of value.messages ?? []) {
        // Only plain text is handled by the chatbot today (Feature 3).
        // Interactive button/list replies, media, etc. will be added as
        // their own message types once those features are built - an
        // unsupported type is intentionally skipped, not an error.
        if (msg.type === 'text' && msg.text?.body) {
          messages.push({
            from: normalizePhone(msg.from),
            waMessageId: msg.id,
            text: msg.text.body,
          });
        }
      }

      for (const status of value.statuses ?? []) {
        statuses.push({
          waMessageId: status.id,
          status: status.status,
          recipientId: normalizePhone(status.recipient_id),
        });
      }
    }
  }

  return { messages, statuses };
}
