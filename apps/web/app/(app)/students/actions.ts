'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function createStudentAction(formData: FormData): Promise<void> {
  await apiFetch('/api/v1/students', {
    method: 'POST',
    json: {
      name: formData.get('name')?.toString(),
      phone: formData.get('phone')?.toString(),
      parentName: formData.get('parentName')?.toString() || undefined,
      beltLevel: formData.get('beltLevel')?.toString() || undefined,
      batchId: formData.get('batchId')?.toString() || undefined,
    },
  });
  revalidatePath('/students');
}
