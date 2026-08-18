'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function sendBroadcastAction(formData: FormData): Promise<void> {
  await apiFetch('/api/v1/broadcasts', {
    method: 'POST',
    json: {
      segment: formData.get('segment')?.toString(),
      templateName: formData.get('templateName')?.toString(),
      bodyPreview: formData.get('bodyPreview')?.toString(),
    },
  });
  revalidatePath('/broadcasts');
}

export async function announceHolidayAction(formData: FormData): Promise<void> {
  await apiFetch('/api/v1/broadcasts/holiday', {
    method: 'POST',
    json: {
      dateLabel: formData.get('dateLabel')?.toString(),
      reason: formData.get('reason')?.toString(),
    },
  });
  revalidatePath('/broadcasts');
}

export async function announceTournamentAction(formData: FormData): Promise<void> {
  await apiFetch('/api/v1/broadcasts/tournament', {
    method: 'POST',
    json: {
      details: formData.get('details')?.toString(),
    },
  });
  revalidatePath('/broadcasts');
}
