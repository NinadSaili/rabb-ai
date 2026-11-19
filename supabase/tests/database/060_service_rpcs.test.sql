begin;
select plan(16);

insert into auth.users (id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.test');
insert into public.learning_paths (id, slug, title, status, reviewed_by, reviewed_at) values ('60000000-0000-4000-8000-000000000000', 'p-one', 'P', 'published', 'e', now());
insert into public.learning_lessons (id, path_id, position, title, body, status, reviewed_by, reviewed_at) values ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000000', 1, 'L', 'B', 'published', 'e', now());
insert into public.quiz_questions (id, lesson_id, prompt, choices, correct_index, status, reviewed_by, reviewed_at) values
  ('70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'Q1', '["a","b","c"]', 1, 'published', 'e', now()),
  ('70000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', 'Q2 draft', '["a","b"]', 0, 'draft', null, null);

-- webhook: idempotent by event id, ordered, only writer
select is(public.rpc_apply_subscription_event('evt-1', 'INITIAL_PURCHASE', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'monthly', 'app_store', false, now() + interval '30 days', now() - interval '2 minutes', true), 'processed', 'webhook: first event is processed');
select is(public.rpc_apply_subscription_event('evt-1', 'INITIAL_PURCHASE', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'monthly', 'app_store', false, now() + interval '30 days', now() - interval '2 minutes', true), 'duplicate', 'webhook: replay of the same event id is a duplicate');
select is((select count(*)::int from public.subscription_events), 1, 'webhook: replay stores nothing new');
select is(public.is_premium('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), true, 'webhook: user is premium after purchase');
select is(public.rpc_apply_subscription_event('evt-0', 'RENEWAL', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'monthly', 'app_store', false, now() - interval '1 day', now() - interval '1 hour', false), 'ignored', 'webhook: older event does not overwrite newer state');
select is(public.is_premium('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), true, 'webhook: stale event left entitlement intact');
select is(public.rpc_apply_subscription_event('evt-2', 'EXPIRATION', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'monthly', 'app_store', false, now() - interval '1 second', now() - interval '1 minute', false), 'processed', 'webhook: expiration processed');
select is(public.is_premium('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), false, 'webhook: expired user is not premium');
select is(public.rpc_apply_subscription_event('evt-3', 'INITIAL_PURCHASE', 'not-a-uuid', 'monthly', 'app_store', false, null, now(), true), 'ignored', 'webhook: unknown app user id is ignored, not an error');

-- quiz: published questions only
create temp table q (j jsonb);
insert into q select public.rpc_start_quiz('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '60000000-0000-4000-8000-000000000001', 5);
select is(jsonb_array_length((select j->'questions' from q)), 1, 'quiz: only published questions are served');
select is((select count(*)::int from jsonb_array_elements((select j->'questions' from q)) e where e ? 'correct_index'), 0, 'quiz: answers are not sent to the client');
create temp table a (j jsonb);
insert into a select public.rpc_answer_quiz('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select (j->>'attempt_id')::uuid from q), '70000000-0000-4000-8000-000000000001', 1, '90000000-0000-4000-8000-000000000001', 'h');
select is((select (j->>'correct')::boolean from a), true, 'quiz: correct answer scored');
select is((select (j->>'attempt_complete')::boolean from a), true, 'quiz: attempt completes after the last answer');
select is(public.rpc_answer_quiz('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select (j->>'attempt_id')::uuid from q), '70000000-0000-4000-8000-000000000001', 0, '90000000-0000-4000-8000-000000000001', 'h')->>'replayed', 'true', 'quiz: retry with the same key replays');

-- streak upsert never lowers the longest streak
select public.rpc_upsert_streak('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 5, 5, '2026-03-10');
select public.rpc_upsert_streak('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, 1, '2026-03-12');
select is((select longest_streak from public.user_streaks where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 5, 'streak: longest never decreases');
select is(public.flag_enabled('ai_tutor_enabled'), true, 'feature flag: tutor kill switch default on');

select * from finish();
rollback;
