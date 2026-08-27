// apps/api/src/services/customer.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// The thing that actually answers "have we talked to this person before" -
// keyed by WhatsApp phone number (customerRepository.findByPhone), NOT by
// Conversation, so the answer stays correct across a closed conversation,
// an escalation, a brand new Conversation row, or a server restart (see
// CustomerProfile's schema comment for why those are different concepts).

import { CustomerProfile } from '@academy/db';
import { customerRepository } from '../repositories/customer.repository';
import { extractName } from '../utils/extractName';

export interface RecordContactResult {
  profile: CustomerProfile;
  /** True only when this customer had never contacted before THIS message - i.e. reflects state before this message counted. */
  isFirstInteraction: boolean;
}

/** Called once per inbound message, before any reply is composed - looks up/creates the profile, opportunistically stores a self-identified name, and bumps interactionCount/lastContactAt. */
async function recordInboundMessage(phone: string, messageText: string): Promise<RecordContactResult> {
  let profile = await customerRepository.findByPhone(phone);
  const isFirstInteraction = !profile;

  if (!profile) {
    profile = await customerRepository.create(phone);
  }

  const name = extractName(messageText);
  if (name && name !== profile.name) {
    profile = await customerRepository.updateName(profile.id, name);
  }

  profile = await customerRepository.recordContact(profile.id);

  return { profile, isFirstInteraction };
}

export const customerService = { recordInboundMessage };
