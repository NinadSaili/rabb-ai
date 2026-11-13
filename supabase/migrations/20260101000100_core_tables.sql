-- Core user tables. UUID primary keys, foreign keys with cascade from auth.users, indexes, constraints.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  timezone text not null default 'UTC',
  ui_language text not null default 'en' check (ui_language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$'),
  age_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  translation_code text not null default 'WEB' check (char_length(translation_code) between 2 and 12),
  morning_reminder_enabled boolean not null default true,
  missed_nudge_enabled boolean not null default false,
  reading_font_scale numeric(3, 2) not null default 1.00 check (reading_font_scale between 0.80 and 3.00),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ritual_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('morning', 'custom')),
  enabled boolean not null default true,
  weekdays smallint[] not null check (
    cardinality(weekdays) between 1 and 7 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  timer_seconds integer check (timer_seconds is null or timer_seconds between 30 and 3600),
  unlock_until text not null default 'window_end' check (unlock_until in ('window_end', 'midnight')),
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ritual_schedules_midnight_custom_only check (kind = 'custom' or unlock_until = 'window_end'),
  constraint ritual_schedules_user_key_unique unique (user_id, idempotency_key)
);
create index ritual_schedules_user_idx on public.ritual_schedules (user_id);
create unique index ritual_schedules_one_morning_per_user on public.ritual_schedules (user_id) where kind = 'morning';

-- Content (editorial). Not user owned.

create table public.scripture_translations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 2 and 12),
  name text not null,
  language text not null check (language ~ '^[a-z]{2,3}$'),
  license_name text not null,
  license_url text,
  copyright_text text not null,
  attribution_text text not null,
  is_public_domain boolean not null default false,
  commercial_use_verified boolean not null default false,
  ai_use_verified boolean not null default false,
  license_verified_at timestamptz,
  include_in_release boolean not null default false,
  is_dev_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Release gate (docs/SCRIPTURE_LICENSING.md): nothing ships without a verified licence.
  constraint scripture_translations_release_gate check (
    not include_in_release
    or (license_verified_at is not null and commercial_use_verified and ai_use_verified and not is_dev_only)
  )
);

create table public.scripture_content (
  id uuid primary key default gen_random_uuid(),
  translation_id uuid not null references public.scripture_translations (id) on delete cascade,
  book text not null check (book ~ '^[1-3A-Z]{3}$'),
  chapter smallint not null check (chapter between 1 and 150),
  verse smallint not null check (verse between 1 and 176),
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scripture_content_unique unique (translation_id, book, chapter, verse)
);

create table public.daily_verses (
  id uuid primary key default gen_random_uuid(),
  publish_date date,
  language text not null default 'en' check (language ~ '^[a-z]{2,3}$'),
  theme text,
  book text not null check (book ~ '^[1-3A-Z]{3}$'),
  chapter smallint not null check (chapter between 1 and 150),
  verse_start smallint not null check (verse_start between 1 and 176),
  verse_end smallint check (verse_end is null or verse_end between verse_start and 176),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'published')),
  reviewed_by text,
  reviewed_at timestamptz,
  is_fallback boolean not null default false,
  fallback_rank integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_verses_review_required check (
    status not in ('approved', 'published') or (reviewed_by is not null and reviewed_at is not null)
  ),
  constraint daily_verses_date_required check (is_fallback or status = 'draft' or publish_date is not null),
  constraint daily_verses_fallback_shape check (not is_fallback or (status = 'approved' and fallback_rank is not null))
);
create unique index daily_verses_one_published_per_day on public.daily_verses (publish_date, language) where status = 'published';
create unique index daily_verses_fallback_rank_unique on public.daily_verses (language, fallback_rank) where is_fallback;

create table public.daily_prayers (
  id uuid primary key default gen_random_uuid(),
  publish_date date,
  language text not null default 'en' check (language ~ '^[a-z]{2,3}$'),
  theme text,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 4000),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'published')),
  reviewed_by text,
  reviewed_at timestamptz,
  is_fallback boolean not null default false,
  fallback_rank integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_prayers_review_required check (
    status not in ('approved', 'published') or (reviewed_by is not null and reviewed_at is not null)
  ),
  constraint daily_prayers_date_required check (is_fallback or status = 'draft' or publish_date is not null),
  constraint daily_prayers_fallback_shape check (not is_fallback or (status = 'approved' and fallback_rank is not null))
);
create unique index daily_prayers_one_published_per_day on public.daily_prayers (publish_date, language) where status = 'published';
create unique index daily_prayers_fallback_rank_unique on public.daily_prayers (language, fallback_rank) where is_fallback;

-- Rituals

create table public.ritual_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  schedule_id uuid not null references public.ritual_schedules (id) on delete cascade,
  -- Server computed at start. Bound for the life of the session.
  local_date date not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned', 'expired')),
  timer_seconds integer check (timer_seconds is null or timer_seconds between 30 and 3600),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Diagnostic only. No logic reads this column.
  client_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ritual_sessions_completed_has_time check ((status = 'completed') = (completed_at is not null))
);
create index ritual_sessions_user_date_idx on public.ritual_sessions (user_id, local_date desc);
create unique index ritual_sessions_one_completed on public.ritual_sessions (user_id, schedule_id, local_date) where status = 'completed';
create unique index ritual_sessions_one_in_progress on public.ritual_sessions (user_id, schedule_id, local_date) where status = 'in_progress';

create table public.ritual_steps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ritual_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  step_type text not null check (step_type in ('scripture', 'prayer', 'timer')),
  idempotency_key uuid not null,
  -- Server received time. Authoritative.
  completed_at timestamptz not null default now(),
  monotonic_ms integer check (monotonic_ms is null or monotonic_ms >= 0),
  -- true: validated against server elapsed time. false: offline reconciliation, device attested. null: not a timer step.
  timer_verified boolean,
  client_completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ritual_steps_session_step_unique unique (session_id, step_type),
  constraint ritual_steps_user_key_unique unique (user_id, idempotency_key),
  constraint ritual_steps_timer_fields check (
    (step_type = 'timer' and monotonic_ms is not null and timer_verified is not null)
    or (step_type <> 'timer' and timer_verified is null)
  )
);
create index ritual_steps_user_idx on public.ritual_steps (user_id);

create table public.idempotency_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  key uuid not null,
  endpoint text not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table public.user_streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_completed_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_streaks_longest_gte_current check (longest_streak >= current_streak)
);

create table public.prayer_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null default current_date,
  title text check (title is null or char_length(title) <= 120),
  body text not null check (char_length(body) between 1 and 20000),
  -- Journal content reaches a model only after explicit opt in, scoped per entry.
  ai_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index prayer_journal_user_idx on public.prayer_journal (user_id, entry_date desc);

-- Learning

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  title text not null check (char_length(title) between 1 and 120),
  description text,
  kind text not null default 'path' check (kind in ('path', 'character_study')),
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'published')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_paths_review_required check (
    status not in ('approved', 'published') or (reviewed_by is not null and reviewed_at is not null)
  )
);

create table public.learning_lessons (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.learning_paths (id) on delete cascade,
  position integer not null check (position >= 1),
  title text not null check (char_length(title) between 1 and 120),
  body text not null,
  scripture_refs jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'published')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_lessons_position_unique unique (path_id, position),
  constraint learning_lessons_review_required check (
    status not in ('approved', 'published') or (reviewed_by is not null and reviewed_at is not null)
  )
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learning_lessons (id) on delete cascade,
  prompt text not null check (char_length(prompt) between 1 and 500),
  choices jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 6),
  correct_index smallint not null check (correct_index between 0 and 5),
  explanation text,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'published')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_questions_correct_in_range check (correct_index < jsonb_array_length(choices)),
  constraint quiz_questions_review_required check (
    status not in ('approved', 'published') or (reviewed_by is not null and reviewed_at is not null)
  )
);
create index quiz_questions_lesson_idx on public.quiz_questions (lesson_id);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.learning_lessons (id) on delete cascade,
  question_ids uuid[] not null check (cardinality(question_ids) between 1 and 10),
  answers jsonb not null default '{}'::jsonb,
  score integer check (score is null or score >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, started_at desc);

-- Subscriptions. Written only by the service role from the webhook function.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  entitlement text not null default 'Rabb.ai Premium',
  product_id text,
  store text check (store is null or store in ('app_store', 'play_store')),
  status text not null check (status in ('active', 'in_grace', 'expired', 'cancelled', 'billing_issue', 'paused')),
  is_trial boolean not null default false,
  will_renew boolean,
  expires_at timestamptz,
  last_event_id text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_events (
  event_id text primary key,
  event_type text not null,
  user_id uuid references auth.users (id) on delete cascade,
  event_timestamp timestamptz not null,
  received_at timestamptz not null default now()
);
create index subscription_events_user_idx on public.subscription_events (user_id);

-- AI platform

create table public.content_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('scripture', 'study', 'lesson', 'character_study')),
  source_id uuid,
  translation_code text,
  book text check (book is null or book ~ '^[1-3A-Z]{3}$'),
  chapter smallint,
  verse_start smallint,
  verse_end smallint,
  content text not null check (char_length(content) between 1 and 4000),
  -- Dimension must match AI_EMBEDDING_DIMENSIONS (docs/ARCHITECTURE.md).
  embedding extensions.vector(1536),
  status text not null default 'approved' check (status = 'approved'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_chunks_embedding_idx on public.content_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index content_chunks_source_idx on public.content_chunks (source_type, source_id);

create table public.tutor_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tutor_threads_user_idx on public.tutor_threads (user_id, updated_at desc);

create table public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.tutor_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  kind text not null default 'answer' check (kind in ('answer', 'no_relevant_content', 'crisis_support', 'declined', 'question')),
  content jsonb not null,
  created_at timestamptz not null default now()
);
create index tutor_messages_thread_idx on public.tutor_messages (thread_id, created_at);

-- Counts and token totals only. Never content.
create table public.ai_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id text not null,
  day date not null default ((now() at time zone 'utc')::date),
  kind text not null check (kind in ('tutor', 'embedding', 'moderation')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at timestamptz not null default now()
);
create index ai_usage_ledger_user_day_idx on public.ai_usage_ledger (user_id, day);

create table public.rate_limit_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, bucket, window_start)
);

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z0-9_]{3,64}$'),
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  -- sha256 of the user id so a tombstone survives deletion without identifying anyone.
  user_id_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index account_deletion_requests_user_idx on public.account_deletion_requests (user_id);

insert into public.feature_flags (key, enabled, description) values
  ('ai_tutor_enabled', true, 'Global kill switch for the AI tutor. Set false to stop all tutor calls.'),
  ('android_tier1_enabled', false, 'Android Tier 1 detection and block screen prototype.'),
  ('android_accessibility_enabled', false, 'Android Tier 2 accessibility path. Default off. Separate build flavor.');

-- updated_at triggers
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'updated_at'
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
