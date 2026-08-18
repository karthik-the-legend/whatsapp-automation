'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { apiFetch } from '@/lib/api';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

/** Multipart upload can't go through apiFetch's JSON-only helper, so this builds the request directly - same Bearer-token pattern, different body encoding. */
export async function uploadDocumentAction(formData: FormData): Promise<void> {
  const { getToken } = await auth();
  const token = await getToken();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('A file is required.');
  }

  const upload = new FormData();
  upload.set('file', file, file.name);
  upload.set('name', formData.get('name')?.toString() ?? '');
  upload.set('type', formData.get('type')?.toString() ?? '');

  const response = await fetch(`${API_BASE_URL}/api/v1/documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: upload,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `Upload failed with status ${response.status}`);
  }

  revalidatePath('/documents');
}

export async function sendDocumentAction(formData: FormData): Promise<void> {
  await apiFetch('/api/v1/documents/send', {
    method: 'POST',
    json: {
      phone: formData.get('phone')?.toString(),
      type: formData.get('type')?.toString(),
    },
  });
}
