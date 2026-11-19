begin;
select plan(7);

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'every public table has row level security enabled'
);
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relforcerowsecurity),
  0, 'every public table forces row level security'
);
select is(
  (select count(*)::int from pg_tables t where t.schemaname = 'public' and (
     select count(distinct p.cmd) from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename
       and p.cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')) < 4),
  0, 'every public table has explicit select, insert, update and delete policies'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and 'anon' = any(roles)),
  0, 'no policy grants anything to anon'
);
select is(
  (select count(*)::int from unnest(array['profiles','user_preferences','ritual_schedules','scripture_translations','scripture_content','daily_verses',
    'daily_prayers','ritual_sessions','ritual_steps','user_streaks','learning_paths','learning_lessons','quiz_questions',
    'quiz_attempts','subscriptions','prayer_journal','content_chunks','tutor_threads','tutor_messages','ai_usage_ledger',
    'rate_limit_counters','feature_flags','account_deletion_requests']) as t
    where to_regclass('public.' || t) is null),
  0, 'all 23 required tables exist'
);
select is(
  (select count(*)::int from pg_tables t where t.schemaname = 'public' and exists (
     select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.tablename and c.column_name = 'updated_at')
     and not exists (select 1 from pg_trigger g where g.tgrelid = ('public.' || t.tablename)::regclass and g.tgname = 'set_updated_at')),
  0, 'every table with updated_at has the updated_at trigger'
);
select is(
  (select count(*)::int from pg_tables t where t.schemaname = 'public' and not exists (
     select 1 from pg_constraint k where k.conrelid = ('public.' || t.tablename)::regclass and k.contype = 'p')),
  0, 'every table has a primary key'
);
select * from finish();
rollback;
