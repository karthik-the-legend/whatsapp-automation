'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function markAttendanceAction(formData: FormData): Promise<void> {
  await apiFetch('/api/v1/attendance', {
    method: 'POST',
    json: {
      studentId: formData.get('studentId')?.toString(),
      batchId: formData.get('batchId')?.toString(),
      date: formData.get('date')?.toString(),
      status: formData.get('status')?.toString(),
    },
  });

  revalidatePath('/attendance');
}
