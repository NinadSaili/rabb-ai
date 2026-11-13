begin;
select plan(13);

-- start from empty editorial tables so seeded DEV fixtures do not interfere
delete from public.daily_verses;
delete from public.daily_prayers;
delete from public.learning_paths;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'free@example.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'premium@example.test');
insert into public.subscriptions (user_id, status, store, expires_at)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'active', 'app_store', now() + interval '30 days');

-- Daily verse selection
insert into public.daily_verses (publish_date, book, chapter, verse_start, status, reviewed_by, reviewed_at, language)
  values ('2026-05-01', 'JHN', 3, 16, 'published', 'editor', now(), 'en');
insert into public.daily_verses (book, chapter, verse_start, status, reviewed_by, reviewed_at, is_fallback, fallback_rank, language) values
  ('PSA', 23, 1, 'approved', 'editor', now(), true, 1, 'en'),
  ('PRO', 3, 5, 'approved', 'editor', now(), true, 2, 'en'),
  ('MAT', 11, 28, 'approved', 'editor', now(), true, 3, 'en');
insert into public.daily_verses (publish_date, book, chapter, verse_start, status, language) values ('2026-05-02', 'GEN', 1, 1, 'draft', 'en');

select is((public.select_daily_verse('2026-05-01', 'en')).book, 'JHN', 'daily verse: published editorial entry wins');
select is((public.select_daily_verse('2026-05-02', 'en')).is_fallback, true, 'daily verse: a draft is never shown, fallback is used');
select is(
  (public.select_daily_verse('2026-05-03', 'en')).id, (public.select_daily_verse('2026-05-03', 'en')).id,
  'daily verse: fallback is deterministic for a date');
select isnt(
  (public.select_daily_verse('2026-05-03', 'en')).id, (public.select_daily_verse('2026-05-04', 'en')).id,
  'daily verse: fallback rotates across consecutive dates');
select is((public.select_daily_verse('2026-05-03', 'es')).id, null, 'daily verse: no entry for a language without content');

insert into public.daily_prayers (title, body, status, reviewed_by, reviewed_at, is_fallback, fallback_rank, language)
  values ('Morning', 'Lord, help me to read.', 'approved', 'editor', now(), true, 1, 'en');
select is((public.select_daily_prayer('2026-05-03', 'en')).title, 'Morning', 'daily prayer: approved fallback is used');

-- Learning content is gated by entitlement at the database level
insert into public.learning_paths (id, slug, title, status, reviewed_by, reviewed_at)
  values ('60000000-0000-4000-8000-000000000000', 'path-one', 'Path one', 'published', 'editor', now());
insert into public.learning_lessons (id, path_id, position, title, body, status, reviewed_by, reviewed_at)
  values ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000000', 1, 'Lesson', 'Body', 'published', 'editor', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is((select count(*)::int from public.learning_paths), 1, 'free user can see published path titles for the paywall');
select is((select count(*)::int from public.learning_lessons), 0, 'free user cannot read lesson bodies');
select is((select count(*)::int from public.daily_verses where status = 'draft'), 0, 'clients never see draft verses');
select is(public.auth_is_premium(), false, 'auth_is_premium is false without a subscription');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*)::int from public.learning_lessons), 1, 'premium user can read lessons');
select is(public.auth_is_premium(), true, 'auth_is_premium is true with an active subscription');
select throws_ok($$select public.is_premium('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$, '42501', null, 'clients cannot ask about another user entitlement');
reset role;

select * from finish();
rollback;
