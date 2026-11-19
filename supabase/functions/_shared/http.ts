import type { ZodTypeAny, z } from 'zod';
import { ZodObject } from 'zod';
import type { ErrorCode } from '@rabb/contracts';

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  validation_failed: 400,
  not_found: 404,
  conflict: 409,
  idempotency_key_reuse: 409,
  rate_limited: 429,
  quota_exceeded: 429,
  premium_required: 403,
  feature_disabled: 503,
  timer_invalid: 422,
  illegal_transition: 409,
  internal: 500,
};

export class ApiException extends Error {
  constructor(public readonly code: ErrorCode, message: string, public readonly extraHeaders: Record<string, string> = {}) {
    super(message);
  }
  get status(): number {
    return STATUS[this.code];
  }
}

export const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, x-request-id, accept',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

export function json(body: unknown, status: number, requestId: string, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': requestId, ...CORS_HEADERS, ...extra },
  });
}

export function errorResponse(e: ApiException, requestId: string): Response {
  return json({ error: { code: e.code, message: e.message, request_id: requestId } }, e.status, requestId, e.extraHeaders);
}

/** Requests reject unknown fields (docs/API_SPECIFICATION.md). */
export function parseWith<S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const target = schema instanceof ZodObject ? schema.strict() : schema;
  const result = target.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ApiException('validation_failed', `${first?.path.join('.') || 'body'}: ${first?.message ?? 'invalid'}`);
  }
  return result.data;
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 64 * 1024) throw new ApiException('validation_failed', 'body too large');
  if (text === '') return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiException('validation_failed', 'body is not valid JSON');
  }
}

/** Stable hash of a validated payload so a reused idempotency key with another payload is detected. */
export async function payloadHash(payload: Record<string, unknown>, ignore: string[] = []): Promise<string> {
  const keys = Object.keys(payload).filter((k) => !ignore.includes(k)).sort();
  const canonical = JSON.stringify(keys.map((k) => [k, payload[k] ?? null]));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Structured logs. Only ids, route, status and timing. Never bodies, prayer text, journal text, tutor text or app identities. */
export function logRequest(entry: { request_id: string; route: string; status: number; ms: number; user?: string; code?: string }): void {
  console.log(JSON.stringify({ level: entry.status >= 500 ? 'error' : 'info', ...entry }));
}
