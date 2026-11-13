-- Domain functions. Writes to ritual tables go through these SECURITY DEFINER functions, callable only by the service role
-- (Edge Functions pass the verified JWT subject as p_user). Server time decides local_date and timer validity.

-- New auth users get a profile and preferences row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Timezone must be a known IANA name.
create or replace function public.validate_profile_timezone()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'validation_failed: unknown timezone %', new.timezone;
  end if;
  return new;
end;
$$;
create trigger validate_timezone before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

-- Day boundary: wall clock minus three hours, in the profile timezone (docs/PRODUCT_REQUIREMENTS.md R-DAY).
create or replace function public.ritual_local_date(p_tz text, p_at timestamptz default now())
returns date
language sql
stable
as $$
  select (((p_at at time zone p_tz) - interval '3 hours'))::date
$$;

-- Service role form. Edge Functions pass the verified JWT subject.
create or replace function public.is_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user
      and s.status in ('active', 'in_grace')
      and (s.expires_at is null or s.expires_at > now())
  )
$$;

-- Authenticated form for RLS policies. Answers only for the caller, never for another user.
create or replace function public.auth_is_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_premium(auth.uid())
$$;
revoke all on function public.auth_is_premium() from public, anon;
grant execute on function public.auth_is_premium() to authenticated, service_role;

-- Idempotency helpers ---------------------------------------------------------

create or replace function public.rb_idem_check(p_user uuid, p_key uuid, p_endpoint text, p_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.idempotency_keys;
begin
  select * into r from public.idempotency_keys where user_id = p_user and key = p_key;
  if not found then return null; end if;
  if r.endpoint <> p_endpoint or r.request_hash <> p_hash then
    raise exception 'idempotency_key_reuse';
  end if;
  return r.response;
end;
$$;

create or replace function public.rb_idem_store(p_user uuid, p_key uuid, p_endpoint text, p_hash text, p_response jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.idempotency_keys (user_id, key, endpoint, request_hash, response)
  values (p_user, p_key, p_endpoint, p_hash, p_response)
  on conflict (user_id, key) do nothing
$$;

-- Ritual RPCs -----------------------------------------------------------------

create or replace function public.rpc_expire_sessions(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_tz text; v_date date; v_count integer;
begin
  select timezone into v_tz from public.profiles where id = p_user;
  v_date := public.ritual_local_date(coalesce(v_tz, 'UTC'), now());
  update public.ritual_sessions set status = 'expired'
    where user_id = p_user and status = 'in_progress' and local_date < v_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.rpc_start_session(
  p_user uuid, p_schedule uuid, p_session_id uuid, p_key uuid, p_hash text, p_client_ts timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text; v_date date; v_sched public.ritual_schedules; v_sess public.ritual_sessions;
  v_resp jsonb; v_prev jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || p_key::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || p_schedule::text, 1));
  v_prev := public.rb_idem_check(p_user, p_key, 'ritual.start', p_hash);
  if v_prev is not null then return v_prev || jsonb_build_object('replayed', true); end if;

  select * into v_sched from public.ritual_schedules where id = p_schedule and user_id = p_user;
  if not found then raise exception 'not_found: schedule'; end if;

  select timezone into v_tz from public.profiles where id = p_user;
  v_date := public.ritual_local_date(coalesce(v_tz, 'UTC'), now());

  update public.ritual_sessions set status = 'expired'
    where user_id = p_user and schedule_id = p_schedule and status = 'in_progress' and local_date < v_date;

  -- A completed session for this date wins, else resume the in progress one.
  select * into v_sess from public.ritual_sessions
    where user_id = p_user and schedule_id = p_schedule and local_date = v_date and status in ('completed', 'in_progress')
    order by (status = 'completed') desc limit 1;

  if not found then
    begin
      insert into public.ritual_sessions (id, user_id, schedule_id, local_date, timer_seconds, client_started_at)
      values (coalesce(p_session_id, gen_random_uuid()), p_user, p_schedule, v_date, v_sched.timer_seconds, p_client_ts)
      returning * into v_sess;
    exception when unique_violation then
      raise exception 'conflict: session could not be created';
    end;
  end if;

  v_resp := jsonb_build_object(
    'session_id', v_sess.id, 'local_date', v_sess.local_date, 'status', v_sess.status,
    'timer_seconds', v_sess.timer_seconds, 'replayed', false
  );
  perform public.rb_idem_store(p_user, p_key, 'ritual.start', p_hash, v_resp);
  return v_resp;
end;
$$;

create or replace function public.rpc_complete_step(
  p_user uuid, p_session uuid, p_step text, p_key uuid, p_hash text,
  p_monotonic_ms integer default null, p_offline boolean default false, p_client_ts timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sess public.ritual_sessions; v_step public.ritual_steps; v_prayer public.ritual_steps;
  v_tz text; v_prev jsonb; v_resp jsonb; v_required integer; v_elapsed_ms numeric; v_verified boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || p_key::text, 0));
  v_prev := public.rb_idem_check(p_user, p_key, 'ritual.complete_step', p_hash);
  if v_prev is not null then return v_prev || jsonb_build_object('replayed', true); end if;

  if p_step not in ('scripture', 'prayer', 'timer') then raise exception 'validation_failed: step_type'; end if;

  select * into v_sess from public.ritual_sessions where id = p_session and user_id = p_user for update;
  if not found then raise exception 'not_found: session'; end if;

  -- First step wins: a second request for the same step with a new key returns the stored step.
  select * into v_step from public.ritual_steps where session_id = p_session and step_type = p_step;
  if found then
    v_resp := jsonb_build_object(
      'session_id', p_session, 'step_type', p_step, 'timer_verified', v_step.timer_verified, 'replayed', true,
      'completed_steps', (select coalesce(jsonb_agg(step_type order by completed_at), '[]'::jsonb) from public.ritual_steps where session_id = p_session)
    );
    perform public.rb_idem_store(p_user, p_key, 'ritual.complete_step', p_hash, v_resp || jsonb_build_object('replayed', false));
    return v_resp;
  end if;

  if v_sess.status <> 'in_progress' then raise exception 'illegal_transition: session_%', v_sess.status; end if;

  select timezone into v_tz from public.profiles where id = p_user;
  if v_sess.local_date <> public.ritual_local_date(coalesce(v_tz, 'UTC'), now()) and not p_offline then
    raise exception 'illegal_transition: session_expired';
  end if;

  if p_step = 'prayer' and not exists (select 1 from public.ritual_steps where session_id = p_session and step_type = 'scripture') then
    raise exception 'illegal_transition: scripture_first';
  end if;

  if p_step = 'timer' then
    if v_sess.timer_seconds is null then raise exception 'illegal_transition: timer_not_configured'; end if;
    select * into v_prayer from public.ritual_steps where session_id = p_session and step_type = 'prayer';
    if not found then raise exception 'illegal_transition: prayer_first'; end if;
    v_required := v_sess.timer_seconds;
    if p_monotonic_ms is null or p_monotonic_ms < v_required * 1000 then raise exception 'timer_invalid: monotonic_too_short'; end if;
    if p_offline then
      v_verified := false;
    else
      v_elapsed_ms := extract(epoch from (now() - v_prayer.completed_at)) * 1000;
      if v_elapsed_ms * 1.05 < v_required * 1000 then raise exception 'timer_invalid: server_elapsed_too_short'; end if;
      if p_monotonic_ms > v_elapsed_ms * 1.05 then raise exception 'timer_invalid: monotonic_exceeds_server'; end if;
      v_verified := true;
    end if;
  end if;

  insert into public.ritual_steps (session_id, user_id, step_type, idempotency_key, monotonic_ms, timer_verified, client_completed_at)
  values (p_session, p_user, p_step, p_key, case when p_step = 'timer' then p_monotonic_ms end, v_verified, p_client_ts);

  v_resp := jsonb_build_object(
    'session_id', p_session, 'step_type', p_step, 'timer_verified', v_verified, 'replayed', false,
    'completed_steps', (select coalesce(jsonb_agg(step_type order by completed_at), '[]'::jsonb) from public.ritual_steps where session_id = p_session)
  );
  perform public.rb_idem_store(p_user, p_key, 'ritual.complete_step', p_hash, v_resp);
  return v_resp;
end;
$$;

create or replace function public.rpc_complete_session(p_user uuid, p_session uuid, p_key uuid, p_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sess public.ritual_sessions; v_winner public.ritual_sessions; v_prev jsonb; v_resp jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || p_key::text, 0));
  v_prev := public.rb_idem_check(p_user, p_key, 'ritual.complete', p_hash);
  if v_prev is not null then return v_prev || jsonb_build_object('replayed', true); end if;

  select * into v_sess from public.ritual_sessions where id = p_session and user_id = p_user for update;
  if not found then raise exception 'not_found: session'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || v_sess.schedule_id::text, 1));

  if v_sess.status = 'completed' then
    v_resp := jsonb_build_object('session_id', v_sess.id, 'local_date', v_sess.local_date, 'status', 'completed',
      'completed_at', v_sess.completed_at, 'first_completion_won', true, 'replayed', false);
    perform public.rb_idem_store(p_user, p_key, 'ritual.complete', p_hash, v_resp);
    return v_resp || jsonb_build_object('replayed', true);
  end if;
  if v_sess.status <> 'in_progress' then raise exception 'illegal_transition: session_%', v_sess.status; end if;

  if not exists (select 1 from public.ritual_steps where session_id = p_session and step_type = 'scripture')
     or not exists (select 1 from public.ritual_steps where session_id = p_session and step_type = 'prayer') then
    raise exception 'illegal_transition: steps_missing';
  end if;
  if v_sess.timer_seconds is not null
     and not exists (select 1 from public.ritual_steps where session_id = p_session and step_type = 'timer') then
    raise exception 'illegal_transition: timer_missing';
  end if;

  -- Another device may have completed the same (schedule, date) first. First completion wins.
  select * into v_winner from public.ritual_sessions
    where user_id = p_user and schedule_id = v_sess.schedule_id and local_date = v_sess.local_date
      and status = 'completed' and id <> v_sess.id;
  if found then
    update public.ritual_sessions set status = 'abandoned' where id = v_sess.id;
    v_resp := jsonb_build_object('session_id', v_winner.id, 'local_date', v_winner.local_date, 'status', 'completed',
      'completed_at', v_winner.completed_at, 'first_completion_won', false, 'replayed', false);
  else
    update public.ritual_sessions set status = 'completed', completed_at = now() where id = v_sess.id returning * into v_sess;
    v_resp := jsonb_build_object('session_id', v_sess.id, 'local_date', v_sess.local_date, 'status', 'completed',
      'completed_at', v_sess.completed_at, 'first_completion_won', true, 'replayed', false);
  end if;
  perform public.rb_idem_store(p_user, p_key, 'ritual.complete', p_hash, v_resp);
  return v_resp;
end;
$$;

-- Rate limits and AI budgets --------------------------------------------------

create or replace function public.consume_rate_limit(p_user uuid, p_bucket text, p_limit integer, p_window_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_start timestamptz; v_count integer;
begin
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limit_counters as c (user_id, bucket, window_start, count)
  values (p_user, p_bucket, v_start, 1)
  on conflict (user_id, bucket, window_start) do update set count = c.count + 1
  returning c.count into v_count;
  return jsonb_build_object('allowed', v_count <= p_limit, 'remaining', greatest(p_limit - v_count, 0),
    'reset_at', v_start + make_interval(secs => p_window_seconds));
end;
$$;

create or replace function public.purge_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  delete from public.rate_limit_counters where window_start < now() - interval '2 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Total tokens a user consumed since a UTC date (inclusive).
create or replace function public.ai_tokens_since(p_user uuid, p_since date)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(input_tokens + output_tokens), 0)::bigint from public.ai_usage_ledger
  where user_id = p_user and day >= p_since
$$;

-- Content selection ------------------------------------------------------------

-- Published entry for the date, else a deterministic approved fallback rotating by date.
create or replace function public.select_daily_verse(p_date date, p_language text default 'en')
returns public.daily_verses
language plpgsql
stable
as $$
declare r public.daily_verses; n integer;
begin
  select * into r from public.daily_verses
    where status = 'published' and publish_date = p_date and language = p_language limit 1;
  if found then return r; end if;
  select count(*) into n from public.daily_verses where is_fallback and language = p_language;
  if n = 0 then return null; end if;
  select * into r from public.daily_verses where is_fallback and language = p_language
    order by fallback_rank offset ((p_date - date '2000-01-01') % n) limit 1;
  return r;
end;
$$;

create or replace function public.select_daily_prayer(p_date date, p_language text default 'en')
returns public.daily_prayers
language plpgsql
stable
as $$
declare r public.daily_prayers; n integer;
begin
  select * into r from public.daily_prayers
    where status = 'published' and publish_date = p_date and language = p_language limit 1;
  if found then return r; end if;
  select count(*) into n from public.daily_prayers where is_fallback and language = p_language;
  if n = 0 then return null; end if;
  select * into r from public.daily_prayers where is_fallback and language = p_language
    order by fallback_rank offset ((p_date - date '2000-01-01') % n) limit 1;
  return r;
end;
$$;

create or replace function public.match_content_chunks(
  p_embedding extensions.vector(1536), p_count integer default 6, p_translation text default null
)
returns table (
  id uuid, source_type text, source_id uuid, translation_code text, book text, chapter smallint,
  verse_start smallint, verse_end smallint, content text, similarity real
)
language sql
stable
set search_path = public, extensions
as $$
  select c.id, c.source_type, c.source_id, c.translation_code, c.book, c.chapter, c.verse_start, c.verse_end, c.content,
         (1 - (c.embedding <=> p_embedding))::real as similarity
  from public.content_chunks c
  where c.status = 'approved' and c.embedding is not null
    and (p_translation is null or c.translation_code is null or c.translation_code = p_translation)
  order by c.embedding <=> p_embedding
  limit least(p_count, 20)
$$;

-- Account deletion -------------------------------------------------------------

create or replace function public.rpc_request_account_deletion(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.account_deletion_requests (user_id, user_id_hash)
  values (p_user, encode(sha256(convert_to(p_user::text, 'UTF8')), 'hex'))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.rpc_complete_account_deletion(p_user_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.account_deletion_requests set status = 'completed', completed_at = now()
  where user_id_hash = p_user_hash and status = 'pending'
$$;

-- Privileges: RPCs are service role only. ------------------------------------

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'rpc_expire_sessions', 'rpc_start_session', 'rpc_complete_step', 'rpc_complete_session',
      'consume_rate_limit', 'purge_rate_limits', 'ai_tokens_since', 'match_content_chunks',
      'rpc_request_account_deletion', 'rpc_complete_account_deletion', 'rb_idem_check', 'rb_idem_store', 'is_premium'
    )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
