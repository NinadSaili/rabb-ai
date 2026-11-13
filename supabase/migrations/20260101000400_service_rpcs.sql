-- Service role RPCs for streaks, subscriptions (webhook), quizzes and the AI ledger.
-- Clients never call these. Edge Functions call them after verifying the JWT subject.

create or replace function public.rpc_upsert_streak(p_user uuid, p_current integer, p_longest integer, p_last date)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_streaks as s (user_id, current_streak, longest_streak, last_completed_date)
  values (p_user, p_current, greatest(p_longest, p_current), p_last)
  on conflict (user_id) do update set
    current_streak = excluded.current_streak,
    longest_streak = greatest(s.longest_streak, excluded.longest_streak, excluded.current_streak),
    last_completed_date = excluded.last_completed_date
$$;

-- RevenueCat webhook writer. Idempotent by event id. Ignores events older than the stored state.
create or replace function public.rpc_apply_subscription_event(
  p_event_id text, p_event_type text, p_app_user_id text, p_product_id text, p_store text,
  p_is_trial boolean, p_expires_at timestamptz, p_event_timestamp timestamptz, p_entitlement_active boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid; v_status text; v_inserted integer; v_will_renew boolean; v_last timestamptz;
begin
  begin
    v_user := p_app_user_id::uuid;
  exception when invalid_text_representation then
    v_user := null;
  end;
  if v_user is not null and not exists (select 1 from auth.users where id = v_user) then v_user := null; end if;

  insert into public.subscription_events (event_id, event_type, user_id, event_timestamp)
  values (p_event_id, p_event_type, v_user, p_event_timestamp)
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 'duplicate'; end if;
  if v_user is null then return 'ignored'; end if;

  select last_event_at into v_last from public.subscriptions where user_id = v_user;
  if v_last is not null and v_last >= p_event_timestamp then return 'ignored'; end if;

  v_status := case
    when p_event_type in ('EXPIRATION') then 'expired'
    when p_event_type in ('BILLING_ISSUE') then 'in_grace'
    when p_event_type in ('SUBSCRIPTION_PAUSED') then 'paused'
    when p_entitlement_active then 'active'
    else 'expired'
  end;
  v_will_renew := case
    when p_event_type in ('CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE') then false
    when p_event_type in ('INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE') then true
    else null
  end;

  insert into public.subscriptions as s (user_id, product_id, store, status, is_trial, will_renew, expires_at, last_event_id, last_event_at)
  values (v_user, p_product_id, p_store, v_status, p_is_trial, v_will_renew, p_expires_at, p_event_id, p_event_timestamp)
  on conflict (user_id) do update set
    product_id = coalesce(excluded.product_id, s.product_id),
    store = coalesce(excluded.store, s.store),
    status = excluded.status,
    is_trial = excluded.is_trial,
    will_renew = coalesce(excluded.will_renew, s.will_renew),
    expires_at = excluded.expires_at,
    last_event_id = excluded.last_event_id,
    last_event_at = excluded.last_event_at;
  return 'processed';
end;
$$;

-- Quizzes use cached, approved questions only. No model call at runtime.
create or replace function public.rpc_start_quiz(p_user uuid, p_lesson uuid, p_count integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_ids uuid[]; v_attempt uuid;
begin
  if not exists (select 1 from public.learning_lessons where id = p_lesson and status = 'published') then
    raise exception 'not_found: lesson';
  end if;
  select coalesce(array_agg(id), '{}') into v_ids from (
    select id from public.quiz_questions where lesson_id = p_lesson and status = 'published'
    order by random() limit greatest(1, least(p_count, 10))
  ) q;
  if cardinality(v_ids) = 0 then raise exception 'not_found: questions'; end if;
  insert into public.quiz_attempts (user_id, lesson_id, question_ids) values (p_user, p_lesson, v_ids) returning id into v_attempt;
  return jsonb_build_object(
    'attempt_id', v_attempt, 'lesson_id', p_lesson,
    'questions', (select jsonb_agg(jsonb_build_object('id', q.id, 'prompt', q.prompt, 'choices', q.choices) order by array_position(v_ids, q.id))
                  from public.quiz_questions q where q.id = any(v_ids))
  );
end;
$$;

create or replace function public.rpc_answer_quiz(
  p_user uuid, p_attempt uuid, p_question uuid, p_choice integer, p_key uuid, p_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att public.quiz_attempts; v_q public.quiz_questions; v_prev jsonb; v_resp jsonb; v_correct boolean;
  v_answers jsonb; v_score integer; v_done boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || p_key::text, 0));
  v_prev := public.rb_idem_check(p_user, p_key, 'learning.answer', p_hash);
  if v_prev is not null then return v_prev || jsonb_build_object('replayed', true); end if;

  select * into v_att from public.quiz_attempts where id = p_attempt and user_id = p_user for update;
  if not found then raise exception 'not_found: attempt'; end if;
  if not (p_question = any(v_att.question_ids)) then raise exception 'not_found: question'; end if;
  select * into v_q from public.quiz_questions where id = p_question;

  if v_att.answers ? p_question::text then
    -- First answer wins.
    v_correct := (v_att.answers -> p_question::text ->> 'correct')::boolean;
  else
    v_correct := (p_choice = v_q.correct_index);
    update public.quiz_attempts set answers = answers || jsonb_build_object(p_question::text, jsonb_build_object('choice', p_choice, 'correct', v_correct))
      where id = p_attempt returning answers into v_answers;
  end if;
  select answers into v_answers from public.quiz_attempts where id = p_attempt;
  v_done := (select count(*) from jsonb_object_keys(v_answers)) >= cardinality(v_att.question_ids);
  select count(*)::int into v_score from jsonb_each(v_answers) e where (e.value ->> 'correct')::boolean;
  if v_done and v_att.completed_at is null then
    update public.quiz_attempts set completed_at = now(), score = v_score where id = p_attempt;
  end if;

  v_resp := jsonb_build_object('correct', v_correct, 'correct_index', v_q.correct_index, 'explanation', v_q.explanation,
    'attempt_complete', v_done, 'score', case when v_done then v_score end, 'replayed', false);
  perform public.rb_idem_store(p_user, p_key, 'learning.answer', p_hash, v_resp);
  return v_resp;
end;
$$;

-- AI: ledger and thread storage. Counts and token totals only in the ledger.
create or replace function public.rpc_ai_ledger_add(p_user uuid, p_request_id text, p_kind text, p_input integer, p_output integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage_ledger (user_id, request_id, kind, input_tokens, output_tokens)
  values (p_user, p_request_id, p_kind, greatest(p_input, 0), greatest(p_output, 0))
$$;

create or replace function public.rpc_tutor_store(p_user uuid, p_thread uuid, p_user_text text, p_kind text, p_answer jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_thread uuid;
begin
  if p_thread is not null then
    select id into v_thread from public.tutor_threads where id = p_thread and user_id = p_user;
    if not found then raise exception 'not_found: thread'; end if;
  else
    insert into public.tutor_threads (user_id) values (p_user) returning id into v_thread;
  end if;
  insert into public.tutor_messages (thread_id, user_id, role, kind, content)
    values (v_thread, p_user, 'user', 'question', jsonb_build_object('text', p_user_text));
  insert into public.tutor_messages (thread_id, user_id, role, kind, content)
    values (v_thread, p_user, 'assistant', p_kind, p_answer);
  update public.tutor_threads set updated_at = now() where id = v_thread;
  return v_thread;
end;
$$;

create or replace function public.flag_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.feature_flags where key = p_key), false)
$$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'rpc_upsert_streak', 'rpc_apply_subscription_event', 'rpc_start_quiz', 'rpc_answer_quiz',
      'rpc_ai_ledger_add', 'rpc_tutor_store', 'flag_enabled'
    )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
