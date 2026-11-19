-- Release safety.
-- 1. DEV ONLY and unverified scripture is never served unless the allow_dev_content flag is on (dev seeds turn it on, production never does).
-- 2. "Unlock until midnight" is only valid for windows that do not cross midnight, so a user can never be left restricted with no way to unlock again.

insert into public.feature_flags (key, enabled, description) values
  ('allow_dev_content', false, 'Serve DEV ONLY scripture fixtures. Must stay false in production. Dev seeds set it to true.')
on conflict (key) do nothing;

create or replace function public.dev_content_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.feature_flags where key = 'allow_dev_content'), false)
$$;
revoke all on function public.dev_content_allowed() from public, anon;
grant execute on function public.dev_content_allowed() to authenticated, service_role;

drop policy scripture_translations_select on public.scripture_translations;
create policy scripture_translations_select on public.scripture_translations for select to authenticated
  using (include_in_release or (is_dev_only and public.dev_content_allowed()));

drop policy scripture_content_select on public.scripture_content;
create policy scripture_content_select on public.scripture_content for select to authenticated
  using (exists (
    select 1 from public.scripture_translations t
    where t.id = scripture_content.translation_id and (t.include_in_release or (t.is_dev_only and public.dev_content_allowed()))
  ));

-- Existing rows that would violate the new rule are normalised before the constraint is added.
update public.ritual_schedules set unlock_until = 'window_end' where unlock_until = 'midnight' and end_minute <= start_minute;
alter table public.ritual_schedules add constraint ritual_schedules_midnight_no_crossing
  check (unlock_until = 'window_end' or end_minute > start_minute);
