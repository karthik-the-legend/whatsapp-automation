'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function createBatchAction(formData: FormData): Promise<void> {
  const daysOfWeek = formData.getAll('daysOfWeek').map((d) => Number(d));
  const feeRupees = Number(formData.get('feeAmount'));

  await apiFetch('/api/v1/batches', {
    method: 'POST',
    json: {
      name: formData.get('name')?.toString(),
      daysOfWeek,
      classStartTime: formData.get('classStartTime')?.toString(),
      feeAmount: Math.round(feeRupees * 100), // rupees entered in the form -> paise stored by the API
      feeCycle: formData.get('feeCycle')?.toString() || undefined,
    },
  });
  revalidatePath('/batches');
}
