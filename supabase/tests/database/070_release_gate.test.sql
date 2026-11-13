begin;
select plan(9);

insert into auth.users (id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.test');
-- A verified, releasable translation for contrast with the DEV ONLY fixture.
insert into public.scripture_translations (id, code, name, language, license_name, copyright_text, attribution_text, is_public_domain,
  commercial_use_verified, ai_use_verified, license_verified_at, include_in_release)
  values ('99999999-0000-4000-8000-000000000001', 'OK1', 'Verified', 'en', 'PD', 'c', 'a', true, true, true, now(), true);
insert into public.scripture_content (translation_id, book, chapter, verse, text) values ('99999999-0000-4000-8000-000000000001', 'PSA', 23, 1, 'verified text');

update public.feature_flags set enabled = false where key = 'allow_dev_content';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is((select count(*)::int from public.scripture_translations where is_dev_only), 0, 'flag off: DEV ONLY translations are not readable by clients');
select is((select count(*)::int from public.scripture_content c join public.scripture_translations t on t.id = c.translation_id where t.is_dev_only), 0, 'flag off: DEV ONLY verse text is not readable by clients');
select is((select count(*)::int from public.scripture_translations where code = 'OK1'), 1, 'flag off: a verified release translation is readable');
select is((select count(*)::int from public.scripture_content where translation_id = '99999999-0000-4000-8000-000000000001'), 1, 'flag off: verified release text is readable');
select is(public.dev_content_allowed(), false, 'dev_content_allowed is false by default');
reset role;

update public.feature_flags set enabled = true where key = 'allow_dev_content';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select cmp_ok((select count(*)::int from public.scripture_translations where is_dev_only), '>=', 1, 'flag on (dev only): fixtures are readable');
reset role;

-- midnight unlock cannot trap the user
insert into public.ritual_schedules (user_id, name, kind, weekdays, start_minute, end_minute, unlock_until)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Evening', 'custom', array[1]::smallint[], 1200, 1320, 'midnight');
select pass('midnight unlock is allowed for a window that stays inside the day');
select throws_ok(
  $$insert into public.ritual_schedules (user_id, name, kind, weekdays, start_minute, end_minute, unlock_until)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Night', 'custom', array[2]::smallint[], 1320, 360, 'midnight')$$,
  '23514', null, 'midnight unlock is rejected for a window that crosses midnight');
select throws_ok(
  $$update public.scripture_translations set include_in_release = true where is_dev_only$$,
  '23514', null, 'a DEV ONLY translation can never be marked for release');

select * from finish();
rollback;
