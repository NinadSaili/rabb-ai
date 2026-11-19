/**
 * Generates explicit RLS policies (migration) and cross user isolation pgTAP tests from one table spec.
 * Run: pnpm exec tsx scripts/gen-rls.ts
 * Output is committed so reviewers read plain SQL.
 */
import { writeFileSync } from 'node:fs';

type Kind = 'owner_rw' | 'owner_ro' | 'service_only' | 'content_read';

interface Spec {
  table: string;
  kind: Kind;
  /** Owner column for user tables. */
  owner?: string;
  /** owner_ro only: owner may delete own rows. */
  deleteOwn?: boolean;
  /** content_read only: select predicate. */
  readWhen?: string;
  /** Seed row for a user. `u` is the user uuid literal, `n` the person index (1 or 2). */
  seed?: (u: string, n: number) => string;
  /** Insert attempted by user 1 on behalf of user 2 (must be rejected). */
  foreignInsert?: (other: string, n: number) => string;
  /** Insert by user 1 for self that must succeed (owner_rw only). */
  ownInsert?: (self: string) => string;
  update?: string;
  /** Identifying where clause for rows of person n. */
  rowWhere?: (u: string, n: number) => string;
}

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id = (kind: number, n: number): string => `${kind}0000000-0000-4000-8000-00000000000${n}`;

const specs: Spec[] = [
  { table: 'profiles', kind: 'owner_rw', owner: 'id', update: "display_name = 'changed'", rowWhere: (u) => `id = '${u}'` },
  { table: 'user_preferences', kind: 'owner_rw', owner: 'user_id', update: "translation_code = 'BSB'", rowWhere: (u) => `user_id = '${u}'` },
  {
    table: 'ritual_schedules', kind: 'owner_rw', owner: 'user_id', update: "name = 'changed'",
    seed: (u, n) => `insert into public.ritual_schedules (id, user_id, name, kind, weekdays, start_minute, end_minute) values ('${id(1, n)}', '${u}', 'seed', 'morning', array[1,2,3]::smallint[], 300, 720)`,
    foreignInsert: (o) => `insert into public.ritual_schedules (user_id, name, kind, weekdays, start_minute, end_minute) values ('${o}', 'x', 'custom', array[1]::smallint[], 60, 120)`,
    ownInsert: (s) => `insert into public.ritual_schedules (user_id, name, kind, weekdays, start_minute, end_minute) values ('${s}', 'mine', 'custom', array[2]::smallint[], 60, 120)`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  {
    table: 'prayer_journal', kind: 'owner_rw', owner: 'user_id', update: "body = 'changed'",
    seed: (u, n) => `insert into public.prayer_journal (id, user_id, body) values ('${id(2, n)}', '${u}', 'private entry ${n}')`,
    foreignInsert: (o) => `insert into public.prayer_journal (user_id, body) values ('${o}', 'x')`,
    ownInsert: (s) => `insert into public.prayer_journal (user_id, body) values ('${s}', 'mine')`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  {
    table: 'ritual_sessions', kind: 'owner_ro', owner: 'user_id', update: "status = 'abandoned'",
    seed: (u, n) => `insert into public.ritual_sessions (id, user_id, schedule_id, local_date) values ('${id(3, n)}', '${u}', '${id(1, n)}', '2026-01-0${n}')`,
    foreignInsert: (o) => `insert into public.ritual_sessions (user_id, schedule_id, local_date) values ('${o}', '${id(1, 2)}', '2026-02-02')`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  {
    table: 'ritual_steps', kind: 'owner_ro', owner: 'user_id', update: "monotonic_ms = 1",
    seed: (u, n) => `insert into public.ritual_steps (session_id, user_id, step_type, idempotency_key) values ('${id(3, n)}', '${u}', 'scripture', '${id(4, n)}')`,
    foreignInsert: (o) => `insert into public.ritual_steps (session_id, user_id, step_type, idempotency_key) values ('${id(3, 2)}', '${o}', 'prayer', gen_random_uuid())`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  {
    table: 'user_streaks', kind: 'owner_ro', owner: 'user_id', update: 'current_streak = 0',
    seed: (u) => `insert into public.user_streaks (user_id, current_streak, longest_streak) values ('${u}', 2, 3)`,
    foreignInsert: (o) => `insert into public.user_streaks (user_id) values ('${o}')`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  {
    table: 'quiz_attempts', kind: 'owner_ro', owner: 'user_id', update: 'score = 0',
    seed: (u, n) => `insert into public.quiz_attempts (id, user_id, lesson_id, question_ids) values ('${id(5, n)}', '${u}', '${id(6, 1)}', array['${id(7, 1)}']::uuid[])`,
    foreignInsert: (o) => `insert into public.quiz_attempts (user_id, lesson_id, question_ids) values ('${o}', '${id(6, 1)}', array['${id(7, 1)}']::uuid[])`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  {
    table: 'subscriptions', kind: 'owner_ro', owner: 'user_id', update: "status = 'expired'",
    seed: (u) => `insert into public.subscriptions (user_id, status, store) values ('${u}', 'active', 'app_store')`,
    foreignInsert: (o) => `insert into public.subscriptions (user_id, status) values ('${o}', 'active')`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  {
    table: 'tutor_messages', kind: 'owner_ro', deleteOwn: true, owner: 'user_id', update: "kind = 'declined'",
    seed: (u, n) => `insert into public.tutor_messages (thread_id, user_id, role, content) values ('${id(8, n)}', '${u}', 'user', '{"text":"private question ${n}"}')`,
    foreignInsert: (o) => `insert into public.tutor_messages (thread_id, user_id, role, content) values ('${id(8, 2)}', '${o}', 'user', '{}')`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  {
    table: 'tutor_threads', kind: 'owner_ro', deleteOwn: true, owner: 'user_id', update: 'updated_at = now()',
    seed: (u, n) => `insert into public.tutor_threads (id, user_id) values ('${id(8, n)}', '${u}')`,
    foreignInsert: (o) => `insert into public.tutor_threads (user_id) values ('${o}')`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  {
    table: 'ai_usage_ledger', kind: 'owner_ro', owner: 'user_id', update: 'input_tokens = 0',
    seed: (u, n) => `insert into public.ai_usage_ledger (user_id, request_id, kind, input_tokens, output_tokens) values ('${u}', 'req-${n}', 'tutor', 10, 20)`,
    foreignInsert: (o) => `insert into public.ai_usage_ledger (user_id, request_id, kind) values ('${o}', 'r', 'tutor')`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  {
    table: 'account_deletion_requests', kind: 'owner_ro', owner: 'user_id', update: "status = 'failed'",
    seed: (u) => `insert into public.account_deletion_requests (user_id, user_id_hash) values ('${u}', 'hash-${u.slice(0, 4)}')`,
    foreignInsert: (o) => `insert into public.account_deletion_requests (user_id, user_id_hash) values ('${o}', 'h')`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  {
    table: 'idempotency_keys', kind: 'service_only', owner: 'user_id', update: "endpoint = 'x'",
    seed: (u, n) => `insert into public.idempotency_keys (user_id, key, endpoint, request_hash, response) values ('${u}', '${id(9, n)}', 'e', 'h', '{}')`,
    foreignInsert: (o) => `insert into public.idempotency_keys (user_id, key, endpoint, request_hash, response) values ('${o}', gen_random_uuid(), 'e', 'h', '{}')`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  {
    table: 'rate_limit_counters', kind: 'service_only', owner: 'user_id', update: 'count = 0',
    seed: (u) => `insert into public.rate_limit_counters (user_id, bucket, window_start, count) values ('${u}', 'b', now(), 1)`,
    foreignInsert: (o) => `insert into public.rate_limit_counters (user_id, bucket, window_start) values ('${o}', 'b2', now())`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  {
    table: 'subscription_events', kind: 'service_only', owner: 'user_id', update: "event_type = 'x'",
    seed: (u, n) => `insert into public.subscription_events (event_id, event_type, user_id, event_timestamp) values ('evt-${n}', 'INITIAL_PURCHASE', '${u}', now())`,
    foreignInsert: (o) => `insert into public.subscription_events (event_id, event_type, user_id, event_timestamp) values ('evt-x', 'T', '${o}', now())`,
    rowWhere: (u) => `user_id = '${u}'`,
  },
  // Content tables.
  { table: 'scripture_translations', kind: 'content_read', readWhen: 'true' },
  { table: 'scripture_content', kind: 'content_read', readWhen: 'true' },
  { table: 'daily_verses', kind: 'content_read', readWhen: "status = 'published' or (is_fallback and status = 'approved')" },
  { table: 'daily_prayers', kind: 'content_read', readWhen: "status = 'published' or (is_fallback and status = 'approved')" },
  { table: 'learning_paths', kind: 'content_read', readWhen: "status = 'published'" },
  { table: 'learning_lessons', kind: 'content_read', readWhen: "status = 'published' and public.auth_is_premium()" },
  { table: 'feature_flags', kind: 'content_read', readWhen: 'true' },
  { table: 'quiz_questions', kind: 'service_only' },
  { table: 'content_chunks', kind: 'service_only' },
];

const q = (s: string) => s;
const own = (col: string) => `(select auth.uid()) = ${col}`;

function policies(s: Spec): string {
  const t = `public.${s.table}`;
  const out: string[] = [`alter table ${t} enable row level security;`, `alter table ${t} force row level security;`];
  const p = (cmd: string, body: string) => out.push(`create policy ${s.table}_${cmd} on ${t} for ${cmd} ${body};`);
  switch (s.kind) {
    case 'owner_rw': {
      const c = s.owner as string;
      p('select', `to authenticated using (${own(c)})`);
      p('insert', `to authenticated with check (${own(c)})`);
      p('update', `to authenticated using (${own(c)}) with check (${own(c)})`);
      p('delete', `to authenticated using (${own(c)})`);
      break;
    }
    case 'owner_ro': {
      const c = s.owner as string;
      p('select', `to authenticated using (${own(c)})`);
      p('insert', 'to authenticated with check (false)');
      p('update', 'to authenticated using (false) with check (false)');
      p('delete', s.deleteOwn ? `to authenticated using (${own(c)})` : 'to authenticated using (false)');
      break;
    }
    case 'content_read':
      p('select', `to authenticated using (${s.readWhen})`);
      p('insert', 'to authenticated with check (false)');
      p('update', 'to authenticated using (false) with check (false)');
      p('delete', 'to authenticated using (false)');
      break;
    case 'service_only':
      p('select', 'to authenticated using (false)');
      p('insert', 'to authenticated with check (false)');
      p('update', 'to authenticated using (false) with check (false)');
      p('delete', 'to authenticated using (false)');
      break;
  }
  return out.join('\n');
}

const migration = [
  '-- GENERATED by scripts/gen-rls.ts. Edit the spec there, not this file.',
  '-- Row Level Security on every table with explicit select, insert, update and delete policies.',
  '-- service_role bypasses RLS and is the only writer for service_only tables and for ritual and subscription writes.',
  '',
  'revoke all on all tables in schema public from anon;',
  'revoke all on all sequences in schema public from anon;',
  'alter default privileges in schema public revoke all on tables from anon;',
  '',
  ...specs.map((s) => `-- ${s.table} (${s.kind})\n${policies(s)}\n`),
].join('\n');
writeFileSync(new URL('../supabase/migrations/20260101000300_rls.sql', import.meta.url), migration);

// ---- pgTAP isolation tests ----
const asUser = (u: string) => `set local role authenticated;\nselect set_config('request.jwt.claims', '{"sub":"${u}","role":"authenticated"}', true);`;
const reset = 'reset role;';
const userTables = specs.filter((s) => s.owner);
const contentTables = specs.filter((s) => !s.owner);

const lines: string[] = [];
let n = 0;
const t = (sql: string) => { n++; lines.push(sql); };

lines.push('-- GENERATED by scripts/gen-rls.ts. Cross user isolation for every table.');
lines.push('begin;', 'select plan(__PLAN__);', '');
lines.push(
  'create schema tests;',
  'grant usage on schema tests to anon, authenticated;',
  'create function tests.rows_affected(sql text) returns integer language plpgsql as $f$ declare n integer; begin execute sql; get diagnostics n = row_count; return n; end $f$;',
  'grant execute on function tests.rows_affected(text) to anon, authenticated;',
);
lines.push(`insert into auth.users (id, email) values ('${A}', 'a@example.test'), ('${B}', 'b@example.test');`);
lines.push(`insert into public.learning_paths (id, slug, title) values ('${id(6, 0)}', 'seed-path', 'Seed path');`);
lines.push(`insert into public.learning_lessons (id, path_id, position, title, body) values ('${id(6, 1)}', '${id(6, 0)}', 1, 'Seed', 'Body');`);
lines.push(`insert into public.quiz_questions (id, lesson_id, prompt, choices, correct_index) values ('${id(7, 1)}', '${id(6, 1)}', 'q', '["a","b"]', 0);`);
const seedOrder = [...userTables].sort((x, y) => Number(y.table === 'tutor_threads') - Number(x.table === 'tutor_threads'));
for (const s of seedOrder) {
  if (!s.seed) continue;
  lines.push(s.seed(A, 1) + ';');
  lines.push(s.seed(B, 2) + ';');
}
lines.push(`update public.profiles set display_name = 'seed' where id in ('${A}', '${B}');`, '');

for (const s of userTables) {
  const tbl = `public.${s.table}`;
  const rowA = (s.rowWhere as (u: string, n: number) => string)(A, 1);
  const rowB = (s.rowWhere as (u: string, n: number) => string)(B, 2);
  lines.push(`-- ${s.table}`);
  lines.push(asUser(A));
  if (s.kind === 'owner_rw' || s.kind === 'owner_ro') {
    t(`select is((select count(*)::int from ${tbl} where ${rowA}), (select count(*)::int from ${tbl}), '${s.table}: A sees only own rows and at least one');`);
    t(`select cmp_ok((select count(*)::int from ${tbl} where ${rowB}), '=', 0, '${s.table}: A cannot select B rows');`);
  } else {
    t(`select is((select count(*)::int from ${tbl}), 0, '${s.table}: client sees nothing');`);
  }
  t(`select is(tests.rows_affected($q$update ${tbl} set ${s.update} where ${rowB}$q$), 0, '${s.table}: A cannot update B rows');`);
  t(`select is(tests.rows_affected($q$delete from ${tbl} where ${rowB}$q$), 0, '${s.table}: A cannot delete B rows');`);
  if (s.foreignInsert) t(`select throws_ok($q$${s.foreignInsert(B, 2)}$q$, '42501', null, '${s.table}: A cannot insert a row for B');`);
  if (s.kind === 'owner_rw') {
    if (s.ownInsert) t(`select lives_ok($q$${s.ownInsert(A)}$q$, '${s.table}: A can insert own row');`);
    t(`select cmp_ok(tests.rows_affected($q$update ${tbl} set ${s.update} where ${rowA}$q$), '>=', 1, '${s.table}: A can update own row');`);
  } else {
    t(`select is(tests.rows_affected($q$update ${tbl} set ${s.update} where ${rowA}$q$), 0, '${s.table}: client cannot update own row (server writes only)');`);
    if (s.kind === 'owner_ro' && !s.deleteOwn) {
      t(`select is(tests.rows_affected($q$delete from ${tbl} where ${rowA}$q$), 0, '${s.table}: client cannot delete own row');`);
    }
    if (s.deleteOwn) {
      t(`select is(tests.rows_affected($q$delete from ${tbl} where ${rowA}$q$), 1, '${s.table}: owner can delete own row');`);
    }
  }
  lines.push(reset);
  // anon role
  lines.push('set local role anon;');
  t(`select throws_ok($q$select count(*) from ${tbl}$q$, '42501', null, '${s.table}: anon has no access');`);
  lines.push(reset, '');
}

for (const s of contentTables) {
  const tbl = `public.${s.table}`;
  lines.push(`-- ${s.table}`);
  lines.push(asUser(A));
  const write = s.table === 'feature_flags'
    ? `insert into ${tbl} (key, enabled) values ('zz_test_flag', true)`
    : s.table === 'scripture_translations'
      ? `insert into ${tbl} (code, name, language, license_name, copyright_text, attribution_text) values ('ZZ', 'z', 'en', 'l', 'c', 'a')`
      : s.table === 'learning_paths'
        ? `insert into ${tbl} (slug, title) values ('zz-path', 'z')`
        : null;
  if (write) t(`select throws_ok($q$${write}$q$, '42501', null, '${s.table}: clients cannot write');`);
  t(`select is(tests.rows_affected($q$update ${tbl} set updated_at = now()$q$), 0, '${s.table}: clients cannot update');`);
  t(`select is(tests.rows_affected($q$delete from ${tbl}$q$), 0, '${s.table}: clients cannot delete');`);
  if (s.kind === 'service_only') t(`select is((select count(*)::int from ${tbl}), 0, '${s.table}: clients cannot read');`);
  lines.push(reset);
  lines.push('set local role anon;');
  t(`select throws_ok($q$select count(*) from ${tbl}$q$, '42501', null, '${s.table}: anon has no access');`);
  lines.push(reset, '');
}

lines.push('select * from finish();', 'rollback;');
writeFileSync(new URL('../supabase/tests/database/010_rls_isolation.test.sql', import.meta.url), lines.join('\n').replace('__PLAN__', String(n)));
console.warn(`wrote RLS migration and ${n} isolation assertions for ${specs.length} tables`);
void q;
