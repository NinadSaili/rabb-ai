import { subscriptionStatusResponse } from '@rabb/contracts';
import { createApiClient, ApiError } from './client';
import { hasPremium } from './entitlement';
import { createRitualSender } from './ritualSync';
import type { Mutation } from '../queue/mutationQueue';

const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const client = (fetchFn: typeof fetch) => createApiClient({ baseUrl: 'https://x.test/functions/v1/v1', getToken: async () => 'tok', fetchFn });
const m = (over: Partial<Mutation>): Mutation => ({ id: '123e4567-e89b-42d3-a456-426614174000', kind: 'ritual.complete', payload: { session_id: '123e4567-e89b-42d3-a456-426614174001' }, createdAt: 0, attempts: 1, ...over });
const envelope = (code: string) => ({ error: { code, message: 'm', request_id: 'r1' } });

describe('api client', () => {
  it('sends the bearer token and maps the structured error envelope', async () => {
    let seen: RequestInit | undefined;
    const api = client((async (_u: string, init?: RequestInit) => { seen = init; return res(403, envelope('premium_required')); }) as never);
    await expect(api.get('/v1/subscription/status', subscriptionStatusResponse)).rejects.toMatchObject({ code: 'premium_required', status: 403, requestId: 'r1' });
    expect((seen?.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });
  it('maps transport failures to a retryable network error', async () => {
    const api = client((async () => { throw new TypeError('offline'); }) as never);
    const err = await api.get('/v1/subscription/status', subscriptionStatusResponse).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('network');
    expect(err.retryable).toBe(true);
  });
  it('rejects responses that do not match the contract', async () => {
    const api = client((async () => res(200, { entitlement: 'gold' })) as never);
    await expect(api.get('/v1/subscription/status', subscriptionStatusResponse)).rejects.toMatchObject({ code: 'unknown' });
  });
  it('builds the url without doubling slashes', async () => {
    let url = '';
    const api = client((async (u: string) => { url = u; return res(200, { entitlement: 'free', active: false, product_id: null, store: null, is_trial: false, will_renew: null, expires_at: null }); }) as never);
    await api.get('/v1/subscription/status', subscriptionStatusResponse);
    expect(url).toBe('https://x.test/functions/v1/v1/subscription/status');
  });
});

describe('ritual sender', () => {
  const ok = { session_id: '123e4567-e89b-42d3-a456-426614174001', local_date: '2026-03-10', status: 'completed', completed_at: '2026-03-10T10:00:00Z', first_completion_won: true, timer_verified: null, current_streak: 1, longest_streak: 1, replayed: false };
  it('uses the mutation id as the idempotency key and reports ok', async () => {
    let body: Record<string, unknown> = {};
    const send = createRitualSender(client((async (_u: string, init?: RequestInit) => { body = JSON.parse(init?.body as string); return res(200, ok); }) as never));
    expect(await send(m({}))).toEqual({ status: 'ok' });
    expect(body.idempotency_key).toBe('123e4567-e89b-42d3-a456-426614174000');
  });
  it('flags steps that already failed once as offline queued', async () => {
    const bodies: Record<string, unknown>[] = [];
    const stepOk = { session_id: ok.session_id, step_type: 'timer', completed_steps: ['timer'], timer_verified: false, replayed: false };
    const send = createRitualSender(client((async (_u: string, init?: RequestInit) => { bodies.push(JSON.parse(init?.body as string)); return res(200, stepOk); }) as never));
    await send(m({ kind: 'ritual.complete_step', attempts: 1, payload: { session_id: ok.session_id, step_type: 'timer', monotonic_ms: 61000 } }));
    await send(m({ kind: 'ritual.complete_step', attempts: 2, payload: { session_id: ok.session_id, step_type: 'timer', monotonic_ms: 61000 } }));
    expect(bodies.map((b) => b.offline_queued)).toEqual([false, true]);
  });
  it('retries on 5xx, 429 and network errors, and drops 4xx the server will never accept', async () => {
    const run = (r: () => Response | Promise<Response>) => createRitualSender(client((async () => r()) as never))(m({}));
    expect(await run(() => res(500, envelope('internal')))).toEqual({ status: 'retry' });
    expect(await run(() => res(429, envelope('rate_limited')))).toEqual({ status: 'retry' });
    expect(await createRitualSender(client((async () => { throw new TypeError('x'); }) as never))(m({}))).toEqual({ status: 'retry' });
    expect(await run(() => res(409, envelope('illegal_transition')))).toEqual({ status: 'rejected', code: 'illegal_transition' });
    expect(await run(() => res(422, envelope('timer_invalid')))).toEqual({ status: 'rejected', code: 'timer_invalid' });
  });
  it('returns the server session id after a start', async () => {
    const startOk = { session_id: '123e4567-e89b-42d3-a456-426614174099', local_date: '2026-03-10', status: 'in_progress', timer_seconds: null, replayed: false };
    const send = createRitualSender(client((async () => res(200, startOk)) as never));
    expect(await send(m({ kind: 'ritual.start', payload: { schedule_id: ok.session_id } }))).toEqual({ status: 'ok', serverSessionId: startOk.session_id });
  });
});

describe('entitlement', () => {
  const base = { entitlement: 'free', active: false, product_id: null, store: null, is_trial: false, will_renew: null, expires_at: null } as const;
  it('is premium only when the server says so', () => {
    expect(hasPremium(undefined)).toBe(false);
    expect(hasPremium(base)).toBe(false);
    expect(hasPremium({ ...base, entitlement: 'premium', active: false })).toBe(false);
    expect(hasPremium({ ...base, entitlement: 'premium', active: true })).toBe(true);
  });
});
