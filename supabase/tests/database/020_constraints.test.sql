begin;
select plan(16);

insert into auth.users (id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.test');
insert into public.ritual_schedules (id, user_id, name, kind, weekdays, start_minute, end_minute, timer_seconds)
  values ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Morning', 'morning', array[1,2,3,4,5]::smallint[], 300, 720, 60);

-- completed session uniqueness
insert into public.ritual_sessions (id, user_id, schedule_id, local_date, status, completed_at)
  values ('30000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', '2026-03-10', 'completed', now());
select throws_ok(
  $$insert into public.ritual_sessions (user_id, schedule_id, local_date, status, completed_at)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', '2026-03-10', 'completed', now())$$,
  '23505', null, 'ritual_sessions: one completed session per (user, schedule, local_date)');
select lives_ok(
  $$insert into public.ritual_sessions (user_id, schedule_id, local_date, status)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', '2026-03-11', 'in_progress')$$,
  'ritual_sessions: a different date is allowed');
select throws_ok(
  $$insert into public.ritual_sessions (user_id, schedule_id, local_date, status)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', '2026-03-11', 'in_progress')$$,
  '23505', null, 'ritual_sessions: one in progress session per (user, schedule, local_date)');
select throws_ok(
  $$insert into public.ritual_sessions (user_id, schedule_id, local_date, status)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', '2026-03-12', 'completed')$$,
  '23514', null, 'ritual_sessions: completed requires completed_at');

-- steps
insert into public.ritual_steps (session_id, user_id, step_type, idempotency_key)
  values ('30000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'scripture', '40000000-0000-4000-8000-000000000001');
select throws_ok(
  $$insert into public.ritual_steps (session_id, user_id, step_type, idempotency_key)
    values ('30000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'scripture', gen_random_uuid())$$,
  '23505', null, 'ritual_steps: one step per (session, step_type)');
select throws_ok(
  $$insert into public.ritual_steps (session_id, user_id, step_type, idempotency_key)
    values ('30000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'prayer', '40000000-0000-4000-8000-000000000001')$$,
  '23505', null, 'ritual_steps: idempotency key unique per user');
select throws_ok(
  $$insert into public.ritual_steps (session_id, user_id, step_type, idempotency_key)
    values ('30000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'timer', gen_random_uuid())$$,
  '23514', null, 'ritual_steps: timer step needs monotonic duration and verification flag');

-- editorial content gates
select throws_ok(
  $$insert into public.daily_verses (publish_date, book, chapter, verse_start, status) values ('2026-05-01', 'JHN', 3, 16, 'published')$$,
  '23514', null, 'daily_verses: published requires reviewed_by and reviewed_at');
select lives_ok(
  $$insert into public.daily_verses (publish_date, book, chapter, verse_start, status, reviewed_by, reviewed_at)
    values ('2026-05-01', 'JHN', 3, 16, 'published', 'editor', now())$$,
  'daily_verses: reviewed entry can publish');
select throws_ok(
  $$insert into public.daily_verses (publish_date, book, chapter, verse_start, status, reviewed_by, reviewed_at)
    values ('2026-05-01', 'PSA', 23, 1, 'published', 'editor', now())$$,
  '23505', null, 'daily_verses: one published verse per date and language');
select throws_ok(
  $$insert into public.daily_prayers (publish_date, title, body, status) values ('2026-05-01', 't', 'b', 'approved')$$,
  '23514', null, 'daily_prayers: approved requires review');
select throws_ok(
  $$insert into public.quiz_questions (lesson_id, prompt, choices, correct_index, status) values (gen_random_uuid(), 'q', '["a","b"]', 0, 'draft')$$,
  '23503', null, 'quiz_questions: lesson must exist');

-- translation release gate
select throws_ok(
  $$insert into public.scripture_translations (code, name, language, license_name, copyright_text, attribution_text, include_in_release)
    values ('ZZ1', 'x', 'en', 'unverified', 'c', 'a', true)$$,
  '23514', null, 'scripture_translations: cannot be included in release without verified licence');
select lives_ok(
  $$insert into public.scripture_translations (code, name, language, license_name, copyright_text, attribution_text, is_dev_only)
    values ('ZZ2', 'x', 'en', 'DEV ONLY unlicensed', 'c', 'a', true)$$,
  'scripture_translations: DEV ONLY fixture allowed outside release');

-- journal and subscriptions
insert into public.prayer_journal (id, user_id, body) values ('20000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'entry');
select is((select ai_opt_in from public.prayer_journal where id = '20000000-0000-4000-8000-000000000001'), false, 'prayer_journal: ai_opt_in defaults to false');
select throws_ok(
  $$insert into public.ritual_schedules (user_id, name, kind, weekdays, start_minute, end_minute, unlock_until)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c', 'morning', array[1]::smallint[], 1, 2, 'midnight')$$,
  '23514', null, 'ritual_schedules: only custom schedules may unlock until midnight');

select * from finish();
rollback;
