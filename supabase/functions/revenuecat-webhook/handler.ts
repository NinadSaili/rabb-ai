import { revenueCatEvent } from '@rabb/contracts';
import type { Db } from '../_shared/db.ts';

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

const ACTIVE_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE', 'CANCELLATION', 'TEST']);

export function createWebhookHandler(deps: { db: Db; secret: string | undefined; entitlementId: string }) {
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
    const supplied = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!deps.secret || !safeEqual(supplied, deps.secret)) return reply(401, { error: 'unauthenticated' });
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return reply(400, { error: 'validation_failed' });
    }
    const parsed = revenueCatEvent.safeParse(payload);
    if (!parsed.success) return reply(400, { error: 'validation_failed' });
    const e = parsed.data.event;
    if (e.entitlement_ids && e.entitlement_ids.length > 0 && !e.entitlement_ids.includes(deps.entitlementId)) {
      return reply(200, { status: 'ignored' });
    }
    const expires = e.expiration_at_ms ? new Date(e.expiration_at_ms) : null;
    const active = ACTIVE_TYPES.has(e.type) && (!expires || expires.getTime() > Date.now());
    const store = e.store === 'APP_STORE' || e.store === 'MAC_APP_STORE' ? 'app_store' : e.store === 'PLAY_STORE' ? 'play_store' : null;
    const status = await deps.db.applySubscriptionEvent([
      e.id, e.type, e.app_user_id, e.product_id ?? null, store, e.period_type === 'TRIAL', expires?.toISOString() ?? null,
      new Date(e.event_timestamp_ms).toISOString(), active,
    ]);
    return reply(200, { status });
  };
}
