begin;
select plan(8);

insert into auth.users (id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.test');
insert into public.ritual_schedules (id, user_id, name, kind, weekdays, start_minute, end_minute)
  values ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Morning', 'morning', array[1]::smallint[], 300, 720);
insert into public.ritual_sessions (id, user_id, schedule_id, local_date) values ('30000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', '2026-03-10');
insert into public.ritual_steps (session_id, user_id, step_type, idempotency_key) values ('30000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'scripture', gen_random_uuid());
insert into public.prayer_journal (user_id, body) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'private');
insert into public.tutor_threads (id, user_id) values ('80000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.tutor_messages (thread_id, user_id, role, content) values ('80000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user', '{"text":"q"}');
insert into public.subscriptions (user_id, status) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'active');
insert into public.ai_usage_ledger (user_id, request_id, kind) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'r', 'tutor');
insert into public.user_streaks (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

select is((select count(*)::int from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'new auth user gets a profile');
select is((select count(*)::int from public.user_preferences where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'new auth user gets preferences');

create temp table req(id uuid);
insert into req select public.rpc_request_account_deletion('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select public.rpc_complete_account_deletion(encode(sha256(convert_to('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'UTF8')), 'hex'));

select is(
  (select sum(c)::int from (
    select count(*) c from public.profiles union all select count(*) from public.user_preferences
    union all select count(*) from public.ritual_schedules union all select count(*) from public.ritual_sessions
    union all select count(*) from public.ritual_steps union all select count(*) from public.prayer_journal
    union all select count(*) from public.tutor_threads union all select count(*) from public.tutor_messages
    union all select count(*) from public.subscriptions union all select count(*) from public.ai_usage_ledger
    union all select count(*) from public.user_streaks union all select count(*) from public.idempotency_keys) x),
  0, 'account deletion removes journals, tutor threads, sessions, subscriptions and every other user row');
select is((select status from public.account_deletion_requests where id = (select id from req)), 'completed', 'deletion request is marked completed');
select is((select user_id from public.account_deletion_requests where id = (select id from req)), null, 'deletion tombstone no longer references the user');

-- rate limits
insert into auth.users (id, email) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@example.test');
select is((public.consume_rate_limit('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'tutor', 2, 60))->>'allowed', 'true', 'rate limit: first call allowed');
select is((public.consume_rate_limit('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'tutor', 2, 60))->>'allowed', 'true', 'rate limit: second call allowed');
select is((public.consume_rate_limit('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'tutor', 2, 60))->>'allowed', 'false', 'rate limit: third call within the window is refused');

select * from finish();
rollback;
