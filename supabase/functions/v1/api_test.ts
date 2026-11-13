import { assert, assertEquals, assertNotEquals } from '@std/assert';
import { call, cleanup, createUser, makeApp, sql, token, uuid } from '../_shared/test_util.ts';

const { app } = makeApp();
const opts = { sanitizeOps: false, sanitizeResources: false };

Deno.test({ name: 'auth: missing and invalid tokens get the structured error envelope', ...opts, fn: async () => {
  const a = await call(app, 'GET', '/v1/habits/summary', null);
  assertEquals(a.status, 401);
  assertEquals(a.body.error.code, 'unauthenticated');
  assert(typeof a.body.error.request_id === 'string' && a.body.error.request_id.length > 0);
  assertEquals(a.headers.get('x-request-id'), a.body.error.request_id);
  const b = await call(app, 'GET', '/v1/habits/summary', 'not-a-jwt');
  assertEquals(b.status, 401);
  const anonKeyLike = await token(uuid(), 'anon');
  assertEquals((await call(app, 'GET', '/v1/habits/summary', anonKeyLike)).status, 401);
  assertEquals((await call(app, 'GET', '/v1/nope', await token(uuid()))).status, 404);
}});

Deno.test({ name: 'daily ritual: today and a 7 day prefetch window with attribution', ...opts, fn: async () => {
  const u = await createUser({ timezone: 'America/New_York', timer: 60 });
  try {
    const r = await call(app, 'GET', '/v1/daily/ritual', u.jwt);
    assertEquals(r.status, 200);
    assertEquals(r.body.days.length, 8);
    assertEquals(r.body.timer_seconds, 60);
    assertEquals(r.body.session, null);
    const today = r.body.days[0];
    assertEquals(today.local_date, r.body.local_date);
    assert(today.verse.text.length > 10);
    assert(today.verse.translation.attribution_text.length > 0);
    assert(today.prayer.body.length > 10);
    assertNotEquals(r.body.days[0].verse.id, r.body.days[1].verse.id);
    const short = await call(app, 'GET', '/v1/daily/ritual?prefetch_days=0', u.jwt);
    assertEquals(short.body.days.length, 1);
  } finally { await cleanup(u.id); }
}});

Deno.test({ name: 'ritual flow: start, steps, complete, idempotent retries, first completion wins', ...opts, fn: async () => {
  const u = await createUser({ timer: null });
  try {
    const startKey = uuid();
    const start = await call(app, 'POST', '/v1/ritual/start', u.jwt, { schedule_id: u.scheduleId, idempotency_key: startKey });
    assertEquals(start.status, 200);
    assertEquals(start.body.status, 'in_progress');
    assertEquals(start.body.replayed, false);
    const sid = start.body.session_id;

    const again = await call(app, 'POST', '/v1/ritual/start', u.jwt, { schedule_id: u.scheduleId, idempotency_key: startKey });
    assertEquals(again.body.replayed, true);
    assertEquals(again.body.session_id, sid);

    const reuse = await call(app, 'POST', '/v1/ritual/start', u.jwt, { schedule_id: uuid(), idempotency_key: startKey });
    assertEquals(reuse.status, 409);
    assertEquals(reuse.body.error.code, 'idempotency_key_reuse');

    const early = await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'prayer', idempotency_key: uuid() });
    assertEquals(early.status, 409);
    assertEquals(early.body.error.code, 'illegal_transition');

    const k1 = uuid();
    const s1 = await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'scripture', idempotency_key: k1 });
    assertEquals(s1.status, 200);
    assertEquals(s1.body.completed_steps, ['scripture']);
    const s1b = await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'scripture', idempotency_key: k1 });
    assertEquals(s1b.body.replayed, true);
    const s2 = await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'prayer', idempotency_key: uuid() });
    assertEquals(s2.body.completed_steps, ['scripture', 'prayer']);

    const ck = uuid();
    const done = await call(app, 'POST', '/v1/ritual/complete', u.jwt, { session_id: sid, idempotency_key: ck });
    assertEquals(done.status, 200);
    assertEquals(done.body.first_completion_won, true);
    assertEquals(done.body.timer_verified, null);
    assertEquals(done.body.current_streak, 1);
    const done2 = await call(app, 'POST', '/v1/ritual/complete', u.jwt, { session_id: sid, idempotency_key: ck });
    assertEquals(done2.body.replayed, true);
    assertEquals(done2.body.completed_at, done.body.completed_at);
    const done3 = await call(app, 'POST', '/v1/ritual/complete', u.jwt, { session_id: sid, idempotency_key: uuid() });
    assertEquals(done3.body.completed_at, done.body.completed_at);

    const rows = await sql`select count(*)::int as n from public.ritual_sessions where user_id = ${u.id} and status = 'completed'`;
    assertEquals(rows[0]!.n, 1);

    // A second start the same day returns the completed session. A second device cannot create a second completion.
    const restart = await call(app, 'POST', '/v1/ritual/start', u.jwt, { schedule_id: u.scheduleId, idempotency_key: uuid() });
    assertEquals(restart.body.status, 'completed');
    assertEquals(restart.body.session_id, sid);

    const habits = await call(app, 'GET', '/v1/habits/summary', u.jwt);
    assertEquals(habits.status, 200);
    assertEquals(habits.body.current_streak, 1);
    assertEquals(habits.body.week.length, 7);
    const streakRow = await sql`select current_streak, longest_streak from public.user_streaks where user_id = ${u.id}`;
    assertEquals(streakRow[0]!.current_streak, 1);
  } finally { await cleanup(u.id); }
}});

Deno.test({ name: 'ritual flow: timer is validated against server time with 5 percent tolerance', ...opts, fn: async () => {
  const u = await createUser({ timer: 60 });
  try {
    const sid = (await call(app, 'POST', '/v1/ritual/start', u.jwt, { schedule_id: u.scheduleId, idempotency_key: uuid() })).body.session_id;
    await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'scripture', idempotency_key: uuid() });
    await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'prayer', idempotency_key: uuid() });

    const missing = await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'timer', idempotency_key: uuid() });
    assertEquals(missing.status, 400);
    const finishEarly = await call(app, 'POST', '/v1/ritual/complete', u.jwt, { session_id: sid, idempotency_key: uuid() });
    assertEquals(finishEarly.status, 409);

    // Client claims 60 s on the monotonic clock but the server saw about 0 s: rejected. A changed device clock cannot help.
    const early = await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'timer', idempotency_key: uuid(), monotonic_ms: 60000, client_timestamp: '2030-01-01T00:00:00Z' });
    assertEquals(early.status, 422);
    assertEquals(early.body.error.code, 'timer_invalid');

    await sql`update public.ritual_steps set completed_at = now() - interval '61 seconds' where session_id = ${sid} and step_type = 'prayer'`;
    const ok = await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'timer', idempotency_key: uuid(), monotonic_ms: 61000 });
    assertEquals(ok.status, 200);
    assertEquals(ok.body.timer_verified, true);
    assertEquals((await call(app, 'POST', '/v1/ritual/complete', u.jwt, { session_id: sid, idempotency_key: uuid() })).status, 200);
  } finally { await cleanup(u.id); }
}});

Deno.test({ name: 'ritual flow: offline queued timer is stored as unverified', ...opts, fn: async () => {
  const u = await createUser({ timer: 60 });
  try {
    const sid = (await call(app, 'POST', '/v1/ritual/start', u.jwt, { schedule_id: u.scheduleId, idempotency_key: uuid() })).body.session_id;
    await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'scripture', idempotency_key: uuid(), offline_queued: true });
    await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'prayer', idempotency_key: uuid(), offline_queued: true });
    const short = await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'timer', idempotency_key: uuid(), monotonic_ms: 30000, offline_queued: true });
    assertEquals(short.status, 422);
    const ok = await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'timer', idempotency_key: uuid(), monotonic_ms: 60500, offline_queued: true });
    assertEquals(ok.status, 200);
    assertEquals(ok.body.timer_verified, false);
    // The completion response says the timer was not server verified.
    const done = await call(app, 'POST', '/v1/ritual/complete', u.jwt, { session_id: sid, idempotency_key: uuid() });
    assertEquals(done.status, 200);
    assertEquals(done.body.timer_verified, false);
  } finally { await cleanup(u.id); }
}});

Deno.test({ name: 'validation: unknown fields and malformed bodies are rejected', ...opts, fn: async () => {
  const u = await createUser();
  try {
    const r = await call(app, 'POST', '/v1/ritual/start', u.jwt, { schedule_id: u.scheduleId, idempotency_key: uuid(), extra: 1 });
    assertEquals(r.status, 400);
    assertEquals(r.body.error.code, 'validation_failed');
    assertEquals((await call(app, 'POST', '/v1/ritual/start', u.jwt, { schedule_id: 'x' })).status, 400);
    const bad = await app(new Request('http://localhost/functions/v1/v1/ritual/start', { method: 'POST', headers: { authorization: `Bearer ${u.jwt}` }, body: '{oops' }));
    assertEquals(bad.status, 400);
    assertEquals((await call(app, 'POST', '/v1/account/delete', u.jwt, { confirm: 'no' })).status, 400);
  } finally { await cleanup(u.id); }
}});

Deno.test({ name: 'isolation: a user cannot start a session on another user schedule', ...opts, fn: async () => {
  const a = await createUser();
  const b = await createUser();
  try {
    const r = await call(app, 'POST', '/v1/ritual/start', b.jwt, { schedule_id: a.scheduleId, idempotency_key: uuid() });
    assertEquals(r.status, 404);
    const list = await call(app, 'GET', '/v1/schedules', b.jwt);
    assertEquals(list.body.schedules.length, 1);
    assertNotEquals(list.body.schedules[0].id, a.scheduleId);
    const sidA = (await call(app, 'POST', '/v1/ritual/start', a.jwt, { schedule_id: a.scheduleId, idempotency_key: uuid() })).body.session_id;
    const steal = await call(app, 'POST', '/v1/ritual/complete-step', b.jwt, { session_id: sidA, step_type: 'scripture', idempotency_key: uuid() });
    assertEquals(steal.status, 404);
  } finally { await cleanup(a.id, b.id); }
}});

Deno.test({ name: 'schedules: create is idempotent, validated, one morning schedule per user', ...opts, fn: async () => {
  const u = await createUser({ schedule: false });
  try {
    const body = { name: 'Evening', kind: 'custom', enabled: true, weekdays: [1, 2, 3], start_minute: 1200, end_minute: 1320, timer_seconds: 120, unlock_until: 'midnight', idempotency_key: uuid() };
    const c = await call(app, 'POST', '/v1/schedules', u.jwt, body);
    assertEquals(c.status, 200);
    assertEquals(c.body.replayed, false);
    const again = await call(app, 'POST', '/v1/schedules', u.jwt, body);
    assertEquals(again.body.replayed, true);
    assertEquals(again.body.id, c.body.id);
    const diff = await call(app, 'POST', '/v1/schedules', u.jwt, { ...body, name: 'Other' });
    assertEquals(diff.status, 409);
    assertEquals((await call(app, 'POST', '/v1/schedules', u.jwt, { ...body, idempotency_key: uuid(), start_minute: 1500 })).status, 400);
    assertEquals((await call(app, 'POST', '/v1/schedules', u.jwt, { ...body, idempotency_key: uuid(), kind: 'morning' })).status, 400);
    const morning = { ...body, name: 'Morning', kind: 'morning', unlock_until: 'window_end', idempotency_key: uuid() };
    assertEquals((await call(app, 'POST', '/v1/schedules', u.jwt, morning)).status, 200);
    assertEquals((await call(app, 'POST', '/v1/schedules', u.jwt, { ...morning, idempotency_key: uuid() })).status, 409);
    assertEquals((await call(app, 'GET', '/v1/schedules', u.jwt)).body.schedules.length, 2);
  } finally { await cleanup(u.id); }
}});

Deno.test({ name: 'rate limit: requests over the bucket limit get 429 with retry-after', ...opts, fn: async () => {
  const u = await createUser();
  try {
    let last = 0;
    for (let i = 0; i < 6; i++) last = (await call(app, 'POST', '/v1/account/delete', u.jwt, { confirm: 'no' })).status;
    assertEquals(last, 429);
    const r = await call(app, 'POST', '/v1/account/delete', u.jwt, { confirm: 'no' });
    assertEquals(r.body.error.code, 'rate_limited');
    assertEquals(r.headers.get('retry-after'), '60');
  } finally { await cleanup(u.id); }
}});

Deno.test({ name: 'account deletion removes all user data and leaves only a hashed tombstone', ...opts, fn: async () => {
  const u = await createUser({ premium: true });
  try {
    const sid = (await call(app, 'POST', '/v1/ritual/start', u.jwt, { schedule_id: u.scheduleId, idempotency_key: uuid() })).body.session_id;
    await call(app, 'POST', '/v1/ritual/complete-step', u.jwt, { session_id: sid, step_type: 'scripture', idempotency_key: uuid() });
    await sql`insert into public.prayer_journal (user_id, body) values (${u.id}, 'private')`;
    const thread = await sql`insert into public.tutor_threads (user_id) values (${u.id}) returning id`;
    await sql`insert into public.tutor_messages (thread_id, user_id, role, content) values (${thread[0]!.id}, ${u.id}, 'user', '{"text":"q"}')`;

    const del = await call(app, 'POST', '/v1/account/delete', u.jwt, { confirm: 'DELETE' });
    assertEquals(del.status, 200);
    assertEquals(del.body.status, 'deleted');
    const remaining = await sql`
      select (select count(*) from public.profiles where id = ${u.id}) + (select count(*) from public.ritual_sessions where user_id = ${u.id})
           + (select count(*) from public.ritual_steps where user_id = ${u.id}) + (select count(*) from public.prayer_journal where user_id = ${u.id})
           + (select count(*) from public.tutor_threads where user_id = ${u.id}) + (select count(*) from public.tutor_messages where user_id = ${u.id})
           + (select count(*) from public.subscriptions where user_id = ${u.id}) + (select count(*) from public.ritual_schedules where user_id = ${u.id}) as n`;
    assertEquals(Number(remaining[0]!.n), 0);
    const tomb = await sql`select status, user_id from public.account_deletion_requests where user_id_hash = encode(sha256(convert_to(${u.id}, 'UTF8')), 'hex')`;
    assertEquals(tomb[0]!.status, 'completed');
    assertEquals(tomb[0]!.user_id, null);
  } finally { await cleanup(u.id); }
}});

Deno.test({ name: 'learning: free users get premium_required, premium users get cached approved questions', ...opts, fn: async () => {
  const free = await createUser();
  const prem = await createUser({ premium: true });
  const path = await sql`insert into public.learning_paths (slug, title, status, reviewed_by, reviewed_at) values (${'p-' + uuid().slice(0, 8)}, 'P', 'published', 'e', now()) returning id`;
  const lesson = await sql`insert into public.learning_lessons (path_id, position, title, body, status, reviewed_by, reviewed_at) values (${path[0]!.id}, 1, 'L', 'B', 'published', 'e', now()) returning id`;
  const q = await sql`insert into public.quiz_questions (lesson_id, prompt, choices, correct_index, status, reviewed_by, reviewed_at) values (${lesson[0]!.id}, 'Q?', '["a","b"]', 1, 'published', 'e', now()) returning id`;
  try {
    const f = await call(app, 'POST', '/v1/learning/quiz', free.jwt, { lesson_id: lesson[0]!.id });
    assertEquals(f.status, 403);
    assertEquals(f.body.error.code, 'premium_required');
    assertEquals((await call(app, 'POST', '/v1/learning/answer', free.jwt, { attempt_id: uuid(), question_id: uuid(), choice_index: 0, idempotency_key: uuid() })).status, 403);

    const p = await call(app, 'POST', '/v1/learning/quiz', prem.jwt, { lesson_id: lesson[0]!.id, count: 3 });
    assertEquals(p.status, 200);
    assertEquals(p.body.questions.length, 1);
    assertEquals(p.body.questions[0].correct_index, undefined);
    const key = uuid();
    const a = await call(app, 'POST', '/v1/learning/answer', prem.jwt, { attempt_id: p.body.attempt_id, question_id: q[0]!.id, choice_index: 1, idempotency_key: key });
    assertEquals(a.body.correct, true);
    assertEquals(a.body.attempt_complete, true);
    const replay = await call(app, 'POST', '/v1/learning/answer', prem.jwt, { attempt_id: p.body.attempt_id, question_id: q[0]!.id, choice_index: 1, idempotency_key: key });
    assertEquals(replay.body.replayed, true);
    const reused = await call(app, 'POST', '/v1/learning/answer', prem.jwt, { attempt_id: p.body.attempt_id, question_id: q[0]!.id, choice_index: 0, idempotency_key: key });
    assertEquals(reused.status, 409);
  } finally { await cleanup(free.id, prem.id); await sql`delete from public.learning_paths where id = ${path[0]!.id}`; }
}});

Deno.test({ name: 'release gate: DEV ONLY scripture is not served when allow_dev_content is off', ...opts, fn: async () => {
  const u = await createUser({ timezone: 'America/New_York' });
  try {
    await sql`update public.feature_flags set enabled = false where key = 'allow_dev_content'`;
    const r = await call(app, 'GET', '/v1/daily/ritual', u.jwt);
    assertEquals(r.status, 404);
    assertEquals(r.body.error.code, 'not_found');
  } finally {
    await sql`update public.feature_flags set enabled = true where key = 'allow_dev_content'`;
    await cleanup(u.id);
  }
}});

Deno.test({ name: 'schedules: midnight unlock is rejected for a window that crosses midnight', ...opts, fn: async () => {
  const u = await createUser({ schedule: false });
  try {
    const body = { name: 'Night', kind: 'custom', enabled: true, weekdays: [1], start_minute: 1320, end_minute: 360, timer_seconds: null, unlock_until: 'midnight', idempotency_key: uuid() };
    const r = await call(app, 'POST', '/v1/schedules', u.jwt, body);
    assertEquals(r.status, 400);
    assertEquals(r.body.error.code, 'validation_failed');
  } finally { await cleanup(u.id); }
}});
