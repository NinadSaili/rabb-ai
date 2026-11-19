import type { Sql, TransactionSql } from 'postgres';
import { ApiException } from './http.ts';

type Json = Record<string, unknown>;

const DOMAIN_ERRORS = /^(illegal_transition|timer_invalid|not_found|idempotency_key_reuse|conflict|validation_failed)\b/;

/** Maps exceptions raised by the SQL RPCs to API errors. Anything else is an internal error. */
export function mapDbError(e: unknown): never {
  const message = e instanceof Error ? e.message : String(e);
  const m = DOMAIN_ERRORS.exec(message);
  if (m) throw new ApiException(m[1] as ConstructorParameters<typeof ApiException>[0], message);
  throw e;
}

export interface ProfileRow {
  timezone: string;
  ui_language: string;
  translation_code: string;
}

export interface VerseView {
  id: string;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number | null;
  theme: string | null;
  text: string;
  translation: { code: string; name: string; language: string; license_name: string; copyright_text: string; attribution_text: string };
}

export interface PrayerView {
  id: string;
  title: string;
  body: string;
  language: string;
}

/**
 * All SQL lives here. Reads that belong to a user run as the `authenticated` role with the user's JWT claims
 * (exactly what PostgREST does), so RLS applies. Writes go through SECURITY DEFINER RPCs that only service role may call.
 */
export class Db {
  constructor(readonly sql: Sql) {}

  async asUser<T>(userId: string, fn: (tx: TransactionSql) => Promise<T>): Promise<T> {
    const claims = JSON.stringify({ sub: userId, role: 'authenticated' });
    return (await this.sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims', ${claims}, true)`;
      await tx`set local role authenticated`;
      return await fn(tx);
    })) as T;
  }

  async rpc<T = Json>(fn: string, args: unknown[]): Promise<T> {
    // fn is an internal constant, never user input.
    const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
    try {
      const rows = await this.sql.unsafe(`select public.${fn}(${placeholders}) as r`, args as never[]);
      return (rows[0] as unknown as { r: T }).r;
    } catch (e) {
      return mapDbError(e);
    }
  }

  // ---- platform ----

  async consumeRateLimit(userId: string, bucket: string, limit: number, windowSeconds: number) {
    return await this.rpc<{ allowed: boolean; remaining: number; reset_at: string }>('consume_rate_limit', [userId, bucket, limit, windowSeconds]);
  }
  async flagEnabled(key: string): Promise<boolean> {
    return await this.rpc<boolean>('flag_enabled', [key]);
  }
  async isPremium(userId: string): Promise<boolean> {
    return await this.rpc<boolean>('is_premium', [userId]);
  }

  // ---- rituals ----

  async getProfile(userId: string): Promise<ProfileRow> {
    return await this.asUser(userId, async (tx) => {
      const rows = await tx`
        select p.timezone, p.ui_language, coalesce(pref.translation_code, 'WEB') as translation_code
        from public.profiles p left join public.user_preferences pref on pref.user_id = p.id
        where p.id = ${userId}`;
      if (rows.length === 0) throw new ApiException('not_found', 'profile not found');
      return rows[0] as unknown as ProfileRow;
    });
  }

  async localDate(tz: string, offsetDays = 0): Promise<string> {
    const rows = await this.sql`select (public.ritual_local_date(${tz}, now()) + ${offsetDays}::int)::text as d`;
    return (rows[0] as { d: string }).d;
  }

  async getSchedule(userId: string, scheduleId: string | undefined) {
    return await this.asUser(userId, async (tx) => {
      const rows = scheduleId
        ? await tx`select id, timer_seconds from public.ritual_schedules where id = ${scheduleId}`
        : await tx`select id, timer_seconds from public.ritual_schedules where kind = 'morning' order by created_at limit 1`;
      return (rows[0] as { id: string; timer_seconds: number | null } | undefined) ?? null;
    });
  }

  /** Verse with text in the requested translation, else the first translation holding every verse. */
  async verseFor(userId: string, date: string, language: string, translationCode: string): Promise<VerseView | null> {
    return await this.asUser(userId, async (tx) => {
      const v = (await tx`select (x).* from (select public.select_daily_verse(${date}::date, ${language}) as x) s`)[0] as Record<string, unknown> | undefined;
      if (!v || v.id === null) return null;
      const need = Number(v.verse_end ?? v.verse_start) - Number(v.verse_start) + 1;
      const rows = await tx`
        select t.code, t.name, t.language, t.license_name, t.copyright_text, t.attribution_text,
               string_agg(c.text, ' ' order by c.verse) as text, count(*)::int as n
        from public.scripture_translations t
        join public.scripture_content c on c.translation_id = t.id
        where c.book = ${v.book as string} and c.chapter = ${v.chapter as number}
          and c.verse between ${v.verse_start as number} and ${(v.verse_end ?? v.verse_start) as number}
        group by t.id
        having count(*) = ${need}
        order by (t.code = ${translationCode}) desc, t.code
        limit 1`;
      const t = rows[0] as Record<string, string> | undefined;
      if (!t) return null;
      return {
        id: v.id as string,
        book: v.book as string,
        chapter: Number(v.chapter),
        verse_start: Number(v.verse_start),
        verse_end: v.verse_end === null ? null : Number(v.verse_end),
        theme: (v.theme as string | null) ?? null,
        text: t.text as string,
        translation: {
          code: t.code as string, name: t.name as string, language: t.language as string, license_name: t.license_name as string,
          copyright_text: t.copyright_text as string, attribution_text: t.attribution_text as string,
        },
      };
    });
  }

  async prayerFor(userId: string, date: string, language: string): Promise<PrayerView | null> {
    return await this.asUser(userId, async (tx) => {
      const p = (await tx`select (x).* from (select public.select_daily_prayer(${date}::date, ${language}) as x) s`)[0] as Record<string, unknown> | undefined;
      if (!p || p.id === null) return null;
      return { id: p.id as string, title: p.title as string, body: p.body as string, language: p.language as string };
    });
  }

  async sessionFor(userId: string, scheduleId: string, date: string) {
    return await this.asUser(userId, async (tx) => {
      const rows = await tx`
        select s.id, s.status,
               coalesce((select array_agg(step_type order by completed_at) from public.ritual_steps where session_id = s.id), '{}') as steps
        from public.ritual_sessions s
        where s.schedule_id = ${scheduleId} and s.local_date = ${date}::date and s.status in ('completed', 'in_progress')
        order by (s.status = 'completed') desc limit 1`;
      return (rows[0] as { id: string; status: string; steps: string[] } | undefined) ?? null;
    });
  }

  async startSession(userId: string, scheduleId: string, sessionId: string | null, key: string, hash: string, clientTs: string | null) {
    return await this.rpc<Json>('rpc_start_session', [userId, scheduleId, sessionId, key, hash, clientTs]);
  }
  async completeStep(userId: string, sessionId: string, step: string, key: string, hash: string, monotonicMs: number | null, offline: boolean, clientTs: string | null) {
    return await this.rpc<Json>('rpc_complete_step', [userId, sessionId, step, key, hash, monotonicMs, offline, clientTs]);
  }
  async completeSession(userId: string, sessionId: string, key: string, hash: string) {
    return await this.rpc<Json>('rpc_complete_session', [userId, sessionId, key, hash]);
  }

  /** Timer step status of a session: true verified, false offline attested, null when there is no timer step. */
  async timerVerified(userId: string, sessionId: string): Promise<boolean | null> {
    return await this.asUser(userId, async (tx) => {
      const rows = await tx`select timer_verified from public.ritual_steps where session_id = ${sessionId} and step_type = 'timer'`;
      return rows.length ? ((rows[0] as { timer_verified: boolean | null }).timer_verified ?? false) : null;
    });
  }

  async completedDates(userId: string): Promise<string[]> {
    return await this.asUser(userId, async (tx) => {
      const rows = await tx`select distinct local_date::text as d from public.ritual_sessions where status = 'completed' order by d desc limit 800`;
      return rows.map((r) => (r as { d: string }).d);
    });
  }
  async upsertStreak(userId: string, current: number, longest: number, last: string | null) {
    await this.rpc('rpc_upsert_streak', [userId, current, longest, last]);
  }
  async storedLongestStreak(userId: string): Promise<number> {
    return await this.asUser(userId, async (tx) => {
      const rows = await tx`select longest_streak from public.user_streaks where user_id = ${userId}`;
      return rows.length ? Number((rows[0] as { longest_streak: number }).longest_streak) : 0;
    });
  }

  // ---- schedules ----

  async listSchedules(userId: string) {
    return await this.asUser(userId, async (tx) =>
      await tx`select id, name, kind, enabled, weekdays::int[] as weekdays, start_minute::int as start_minute, end_minute::int as end_minute,
                      timer_seconds, unlock_until from public.ritual_schedules order by created_at`);
  }

  async createSchedule(userId: string, s: Record<string, unknown>, key: string) {
    return await this.asUser(userId, async (tx) => {
      const inserted = await tx`
        insert into public.ritual_schedules (user_id, name, kind, enabled, weekdays, start_minute, end_minute, timer_seconds, unlock_until, idempotency_key)
        values (${userId}, ${s.name as string}, ${s.kind as string}, ${s.enabled as boolean}, ${s.weekdays as number[]}::smallint[],
                ${s.start_minute as number}, ${s.end_minute as number}, ${(s.timer_seconds ?? null) as number | null}, ${s.unlock_until as string}, ${key})
        on conflict (user_id, idempotency_key) do nothing
        returning id, name, kind, enabled, weekdays::int[] as weekdays, start_minute::int as start_minute, end_minute::int as end_minute, timer_seconds, unlock_until`;
      if (inserted.length) return { row: inserted[0] as Record<string, unknown>, replayed: false };
      const existing = await tx`
        select id, name, kind, enabled, weekdays::int[] as weekdays, start_minute::int as start_minute, end_minute::int as end_minute, timer_seconds, unlock_until
        from public.ritual_schedules where idempotency_key = ${key}`;
      return { row: existing[0] as Record<string, unknown>, replayed: true };
    });
  }

  // ---- subscription ----

  async subscriptionStatus(userId: string) {
    return await this.asUser(userId, async (tx) => {
      const rows = await tx`select product_id, store, status, is_trial, will_renew, expires_at from public.subscriptions where user_id = ${userId}`;
      return (rows[0] as Record<string, unknown> | undefined) ?? null;
    });
  }

  async applySubscriptionEvent(args: unknown[]): Promise<'processed' | 'duplicate' | 'ignored'> {
    return await this.rpc<'processed' | 'duplicate' | 'ignored'>('rpc_apply_subscription_event', args);
  }

  // ---- learning ----

  async startQuiz(userId: string, lessonId: string, count: number) {
    return await this.rpc<Json>('rpc_start_quiz', [userId, lessonId, count]);
  }
  async answerQuiz(userId: string, attemptId: string, questionId: string, choice: number, key: string, hash: string) {
    return await this.rpc<Json>('rpc_answer_quiz', [userId, attemptId, questionId, choice, key, hash]);
  }


  // ---- AI ----

  async tokensSince(userId: string, sinceDate: string): Promise<number> {
    return Number(await this.rpc<number | string>('ai_tokens_since', [userId, sinceDate]));
  }
  async ledgerAdd(userId: string, requestId: string, kind: 'tutor' | 'embedding' | 'moderation', input: number, output: number) {
    await this.rpc('rpc_ai_ledger_add', [userId, requestId, kind, input, output]);
  }
  async matchChunks(embedding: number[], count: number, translation: string | null) {
    const rows = await this.sql`
      select * from public.match_content_chunks(${JSON.stringify(embedding)}::extensions.vector(1536), ${count}, ${translation})`;
    return rows as unknown as {
      id: string; source_type: string; translation_code: string | null; book: string | null; chapter: number | null;
      verse_start: number | null; verse_end: number | null; content: string; similarity: number;
    }[];
  }
  /** Stored verses for a reference. Prefers the requested translation, else the first translation holding every verse. */
  async scriptureVerses(userId: string, ref: { book: string; chapter: number; verse_start: number; verse_end?: number }, translation: string) {
    const end = ref.verse_end ?? ref.verse_start;
    if (end < ref.verse_start || end - ref.verse_start > 40) return null;
    const need = end - ref.verse_start + 1;
    return await this.asUser(userId, async (tx) => {
      const rows = await tx`
        select t.code, array_agg(c.text order by c.verse) as verses
        from public.scripture_translations t join public.scripture_content c on c.translation_id = t.id
        where c.book = ${ref.book} and c.chapter = ${ref.chapter} and c.verse between ${ref.verse_start} and ${end}
        group by t.id having count(*) = ${need}
        order by (t.code = ${translation}) desc, t.code limit 1`;
      const r = rows[0] as { code: string; verses: string[] } | undefined;
      return r ? { translation: r.code, verses: r.verses } : null;
    });
  }
  /** Only entries the owner flagged ai_opt_in. RLS ensures ownership. */
  async journalForAi(userId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    return await this.asUser(userId, async (tx) => {
      const rows = await tx`select body from public.prayer_journal where id = any(${ids}::uuid[]) and ai_opt_in`;
      return rows.map((r) => (r as { body: string }).body);
    });
  }
  async tutorStore(userId: string, thread: string | null, question: string, kind: string, answer: unknown): Promise<string> {
    return await this.rpc<string>('rpc_tutor_store', [userId, thread, question, kind, JSON.stringify(answer)]);
  }

  // ---- account ----

  async requestAccountDeletion(userId: string): Promise<string> {
    return await this.rpc<string>('rpc_request_account_deletion', [userId]);
  }
  async completeAccountDeletion(userId: string) {
    const hash = await userHash(userId);
    await this.rpc('rpc_complete_account_deletion', [hash]);
  }
}

export async function userHash(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
