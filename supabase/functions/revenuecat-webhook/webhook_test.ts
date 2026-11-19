import { assertEquals } from '@std/assert';
import { cleanup, createUser, db, makeApp, call, sql } from '../_shared/test_util.ts';
import { createWebhookHandler } from './handler.ts';

const SECRET = 'whsec-test-123';
const opts = { sanitizeOps: false, sanitizeResources: false };
const handler = createWebhookHandler({ db, secret: SECRET, entitlementId: 'Rabb.ai Premium' });

const event = (over: Record<string, unknown>, userId: string) => ({
  api_version: '1.0',
  event: {
    id: crypto.randomUUID(), type: 'INITIAL_PURCHASE', app_user_id: userId, product_id: 'rabb_premium_monthly',
    entitlement_ids: ['Rabb.ai Premium'], period_type: 'NORMAL', store: 'APP_STORE',
    expiration_at_ms: Date.now() + 30 * 86400_000, event_timestamp_ms: Date.now(), environment: 'SANDBOX', ...over,
  },
});
const send = (body: unknown, auth: string | null = `Bearer ${SECRET}`, method = 'POST') =>
  handler(new Request('http://localhost/revenuecat-webhook', { method, headers: { ...(auth ? { authorization: auth } : {}), 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined }));

Deno.test({ name: 'webhook: rejects a missing or wrong authorization secret', ...opts, fn: async () => {
  const u = await createUser();
  try {
    assertEquals((await send(event({}, u.id), null)).status, 401);
    assertEquals((await send(event({}, u.id), 'Bearer wrong')).status, 401);
    assertEquals((await send(event({}, u.id), `Bearer ${SECRET}x`)).status, 401);
    assertEquals((await send({}, `Bearer ${SECRET}`)).status, 400);
    assertEquals((await send({}, `Bearer ${SECRET}`, 'GET')).status, 405);
    const none = createWebhookHandler({ db, secret: undefined, entitlementId: 'x' });
    assertEquals((await none(new Request('http://x', { method: 'POST', body: '{}' }))).status, 401);
    const rows = await sql`select count(*)::int as n from public.subscriptions where user_id = ${u.id}`;
    assertEquals(rows[0]!.n, 0);
  } finally { await cleanup(u.id); }
}});

Deno.test({ name: 'webhook: processes, is idempotent by event id, ignores stale events, and drives entitlement', ...opts, fn: async () => {
  const { app } = makeApp();
  const u = await createUser();
  try {
    assertEquals((await call(app, 'GET', '/v1/subscription/status', u.jwt)).body.entitlement, 'free');
    const purchase = event({ event_timestamp_ms: Date.now() - 60_000 }, u.id);
    const r1 = await send(purchase);
    assertEquals(r1.status, 200);
    assertEquals((await r1.json()).status, 'processed');
    const r2 = await send(purchase);
    assertEquals(r2.status, 200);
    assertEquals((await r2.json()).status, 'duplicate');
    const status = await call(app, 'GET', '/v1/subscription/status', u.jwt);
    assertEquals(status.body.entitlement, 'premium');
    assertEquals(status.body.store, 'app_store');
    assertEquals(status.body.will_renew, true);

    const stale = await send(event({ type: 'EXPIRATION', event_timestamp_ms: Date.now() - 3_600_000, expiration_at_ms: Date.now() - 1000 }, u.id));
    assertEquals((await stale.json()).status, 'ignored');
    assertEquals((await call(app, 'GET', '/v1/subscription/status', u.jwt)).body.entitlement, 'premium');

    const exp = await send(event({ type: 'EXPIRATION', event_timestamp_ms: Date.now(), expiration_at_ms: Date.now() - 1000 }, u.id));
    assertEquals((await exp.json()).status, 'processed');
    assertEquals((await call(app, 'GET', '/v1/subscription/status', u.jwt)).body.entitlement, 'free');
    const events = await sql`select count(*)::int as n from public.subscription_events where user_id = ${u.id}`;
    assertEquals(events[0]!.n, 3);
  } finally { await cleanup(u.id); }
}});

Deno.test({ name: 'webhook: other entitlements and unknown users are ignored, clients cannot write subscriptions', ...opts, fn: async () => {
  const u = await createUser();
  try {
    assertEquals((await (await send(event({ entitlement_ids: ['Other'] }, u.id))).json()).status, 'ignored');
    assertEquals((await (await send(event({}, 'not-a-uuid'))).json()).status, 'ignored');
    assertEquals((await (await send(event({}, crypto.randomUUID()))).json()).status, 'ignored');
    const { app } = makeApp();
    // The client facing API has no route that writes subscriptions.
    assertEquals((await call(app, 'POST', '/v1/subscription/status', u.jwt, {})).status, 404);
    const rows = await sql`select count(*)::int as n from public.subscriptions where user_id = ${u.id}`;
    assertEquals(rows[0]!.n, 0);
  } finally { await cleanup(u.id); }
}});
