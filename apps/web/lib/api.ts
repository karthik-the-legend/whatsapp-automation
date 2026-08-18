// apps/web/lib/api.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Every Server Component / Server Action in this app talks to @academy/api
// over plain HTTP, never Prisma directly - the API is the single source of
// truth for business logic (see the architecture rules in apps/api's
// AGENTS.md). This is the one place that attaches the signed-in admin's
// Clerk session token as a Bearer header, so clerkAuth.plugin.ts on the
// API side can verify it and resolve the AdminUser.

import { auth } from '@clerk/nextjs/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

export class ApiRequestError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  details?: unknown;
}

/** JSON request/response helper. For multipart (file upload), build FormData and pass it as `body` with no `json` option. */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { getToken } = await auth();
  const token = await getToken();
  const { json, headers, ...rest } = init;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: 'no-store',
  });

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok) {
    throw new ApiRequestError(response.status, envelope?.message ?? `Request failed with status ${response.status}`, envelope?.details);
  }

  return (envelope?.data ?? envelope) as T;
}
