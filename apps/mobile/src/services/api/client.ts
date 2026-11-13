import { apiError, type ErrorCode } from '@rabb/contracts';
import type { ZodTypeAny, z } from 'zod';

export class ApiError extends Error {
  constructor(readonly code: ErrorCode | 'network' | 'unknown', readonly status: number, message: string, readonly requestId: string | null) {
    super(message);
  }
  /** Failures the queue should retry later instead of dropping. */
  get retryable(): boolean {
    return this.code === 'network' || this.status >= 500 || this.status === 429;
  }
}

export interface ApiClientOptions {
  /** Base URL of the Supabase functions host plus the function name, for example https://x.supabase.co/functions/v1/v1 */
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch;
}

export interface ApiClient {
  get<S extends ZodTypeAny>(path: string, schema: S, query?: Record<string, string | number | undefined>): Promise<z.infer<S>>;
  post<S extends ZodTypeAny>(path: string, body: unknown, schema: S): Promise<z.infer<S>>;
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const doFetch = opts.fetchFn ?? fetch;

  async function request<S extends ZodTypeAny>(method: 'GET' | 'POST', path: string, schema: S, body?: unknown, query?: Record<string, string | number | undefined>) {
    const token = await opts.getToken();
    const qs = query ? `?${Object.entries(query).filter(([, v]) => v !== undefined).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}` : '';
    let res: Response;
    try {
      res = await doFetch(`${opts.baseUrl}${path.replace(/^\/v1/, '')}${qs}`.replace(/(?<!:)\/\//g, '/'), {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('network', 0, 'network request failed', null);
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const parsed = apiError.safeParse(json);
      if (parsed.success) throw new ApiError(parsed.data.error.code, res.status, parsed.data.error.message, parsed.data.error.request_id);
      throw new ApiError('unknown', res.status, `request failed (${res.status})`, null);
    }
    const out = schema.safeParse(json);
    if (!out.success) throw new ApiError('unknown', res.status, 'response did not match the contract', res.headers.get('x-request-id'));
    return out.data as z.infer<S>;
  }

  return {
    get: (path, schema, query) => request('GET', path, schema, undefined, query),
    post: (path, body, schema) => request('POST', path, schema, body),
  };
}
