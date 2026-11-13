begin;
select plan(35);

-- Same fixtures as packages/schedule-core tests: wall clock minus 3 hours in the profile timezone.
select is(public.ritual_local_date('America/New_York', '2026-06-10 06:59:00+00'), date '2026-06-09', 'day boundary: 02:59 local is the previous date');
select is(public.ritual_local_date('America/New_York', '2026-06-10 07:00:00+00'), date '2026-06-10', 'day boundary: 03:00 local starts the new date');
select is(public.ritual_local_date('America/New_York', '2026-03-08 06:59:00+00'), date '2026-03-07', 'DST spring forward: 01:59 EST');
select is(public.ritual_local_date('America/New_York', '2026-03-08 07:00:00+00'), date '2026-03-08', 'DST spring forward: 03:00 EDT');
select is(public.ritual_local_date('America/New_York', '2026-11-01 06:30:00+00'), date '2026-10-31', 'DST fall back: second 01:30');
select is(public.ritual_local_date('America/New_York', '2026-11-01 08:00:00+00'), date '2026-11-01', 'DST fall back: 03:00 EST');
select is(public.ritual_local_date('America/Havana', ((timestamp '2026-03-08 03:00') at time zone 'America/Havana')), date '2026-03-08', 'midnight shift zone: 03:00 starts the date');
select is(public.ritual_local_date('America/Havana', ((timestamp '2026-03-08 03:00') at time zone 'America/Havana') - interval '1 second'), date '2026-03-07', 'midnight shift zone: one second before');
select is(public.ritual_local_date('Pacific/Auckland', '2026-06-10 10:00:00+00'), date '2026-06-10', 'timezone changes the date for the same instant');
select is(public.ritual_local_date('America/Los_Angeles', '2026-06-10 09:59:00+00'), date '2026-06-09', 'timezone changes the date for the same instant (LA)');

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@example.test');
update public.profiles set timezone = 'America/New_York' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into public.ritual_schedules (id, user_id, name, kind, weekdays, start_minute, end_minute, timer_seconds) values
  ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Morning', 'morning', array[0,1,2,3,4,5,6]::smallint[], 300, 720, 60),
  ('10000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'No timer', 'custom', array[0,1,2,3,4,5,6]::smallint[], 300, 720, null);

-- start
create temp table r (n text, j jsonb);
insert into r select 'start1', public.rpc_start_session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'h1');
select is((select j->>'status' from r where n = 'start1'), 'in_progress', 'start: creates an in progress session');
select is((select (j->>'local_date')::date from r where n = 'start1'), public.ritual_local_date('America/New_York', now()), 'start: local_date is computed by the server');
insert into r select 'start1b', public.rpc_start_session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', null, '50000000-0000-4000-8000-000000000001', 'h1');
select is((select (j->>'replayed')::boolean from r where n = 'start1b'), true, 'start: retry with the same key replays');
select is((select j->>'session_id' from r where n = 'start1b'), '30000000-0000-4000-8000-000000000001', 'start: replay returns the original session');
select throws_ok($$select public.rpc_start_session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', null, '50000000-0000-4000-8000-000000000001', 'different')$$,
  'P0001', 'idempotency_key_reuse', 'start: same key with a different payload is rejected');
select throws_ok($$select public.rpc_start_session('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '10000000-0000-4000-8000-000000000001', null, gen_random_uuid(), 'h')$$,
  'P0001', 'not_found: schedule', 'start: another user cannot use a schedule they do not own');
insert into r select 'start2', public.rpc_start_session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', null, gen_random_uuid(), 'h2');
select is((select j->>'session_id' from r where n = 'start2'), '30000000-0000-4000-8000-000000000001', 'start: second start the same day resumes the same session');

-- steps: order and idempotency
select throws_ok($$select public.rpc_complete_step('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', 'prayer', gen_random_uuid(), 'p')$$,
  'P0001', 'illegal_transition: scripture_first', 'step: prayer before scripture is rejected');
insert into r select 'scr', public.rpc_complete_step('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', 'scripture', '60000000-0000-4000-8000-000000000001', 'hs');
select is((select j->'completed_steps' from r where n = 'scr'), '["scripture"]'::jsonb, 'step: scripture recorded');
insert into r select 'scr_retry', public.rpc_complete_step('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', 'scripture', '60000000-0000-4000-8000-000000000001', 'hs');
select is((select (j->>'replayed')::boolean from r where n = 'scr_retry'), true, 'step: retry with the same key replays');
insert into r select 'scr_newkey', public.rpc_complete_step('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', 'scripture', gen_random_uuid(), 'hs2');
select is((select count(*)::int from public.ritual_steps where session_id = '30000000-0000-4000-8000-000000000001'), 1, 'step: duplicate scripture with a new key does not create a second row');
select throws_ok($$select public.rpc_complete_step('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '30000000-0000-4000-8000-000000000001', 'prayer', gen_random_uuid(), 'x')$$,
  'P0001', 'not_found: session', 'step: another user cannot complete steps of this session');
select throws_ok($$select public.rpc_complete_session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', gen_random_uuid(), 'c')$$,
  'P0001', 'illegal_transition: steps_missing', 'complete: needs scripture and prayer');
select lives_ok($$select public.rpc_complete_step('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', 'prayer', gen_random_uuid(), 'hp')$$, 'step: prayer after scripture');
select throws_ok($$select public.rpc_complete_session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', gen_random_uuid(), 'c')$$,
  'P0001', 'illegal_transition: timer_missing', 'complete: configured timer must be completed');

-- timer validation against server received timestamps
select throws_ok($$select public.rpc_complete_step('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', 'timer', gen_random_uuid(), 't', 59000)$$,
  'P0001', 'timer_invalid: monotonic_too_short', 'timer: monotonic duration below the configured seconds is rejected');
select throws_ok($$select public.rpc_complete_step('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', 'timer', gen_random_uuid(), 't', 60000)$$,
  'P0001', 'timer_invalid: server_elapsed_too_short', 'timer: early completion (server saw too little time) is rejected');
-- move the prayer step 61 seconds into the past, as if the user had waited
update public.ritual_steps set completed_at = now() - interval '61 seconds' where session_id = '30000000-0000-4000-8000-000000000001' and step_type = 'prayer';
select throws_ok($$select public.rpc_complete_step('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', 'timer', gen_random_uuid(), 't', 600000)$$,
  'P0001', 'timer_invalid: monotonic_exceeds_server', 'timer: claim far above server elapsed time is rejected');
insert into r select 'timer', public.rpc_complete_step('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', 'timer', gen_random_uuid(), 't', 61000);
select is((select (j->>'timer_verified')::boolean from r where n = 'timer'), true, 'timer: valid online completion is verified');

-- complete and first completion wins
insert into r select 'done', public.rpc_complete_session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'c1');
select is((select (j->>'first_completion_won')::boolean from r where n = 'done'), true, 'complete: first completion wins');
insert into r select 'done_retry', public.rpc_complete_session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'c1');
select is((select j->>'completed_at' from r where n = 'done_retry'), (select j->>'completed_at' from r where n = 'done'), 'complete: retry returns the original completion time');
select is((select count(*)::int from public.ritual_sessions where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and schedule_id = '10000000-0000-4000-8000-000000000001' and status = 'completed'), 1, 'complete: exactly one completed session');

-- offline: unverified timer, still validated minimum
insert into r select 'off_start', public.rpc_start_session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000002', null, gen_random_uuid(), 'o1');
select is((select (j->>'timer_seconds') from r where n = 'off_start'), null, 'schedule without a timer starts without a timer');
select throws_ok(format($$select public.rpc_complete_step('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', %L, 'scripture', gen_random_uuid(), 'x')$$, 'bbbbbbbb-0000-4000-8000-000000000000'),
  'P0001', 'not_found: session', 'step: unknown session');

-- privileges
set local role authenticated;
select throws_ok($$select public.rpc_start_session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', null, gen_random_uuid(), 'h')$$,
  '42501', null, 'privileges: authenticated clients cannot call ritual RPCs');
reset role;

select * from finish();
rollback;
