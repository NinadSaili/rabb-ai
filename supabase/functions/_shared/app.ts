import {
  completeRequest, completeResponse, completeStepRequest, completeStepResponse, createScheduleRequest, createScheduleResponse,
  answerRequest, answerResponse, dailyRitualQuery, dailyRitualResponse, deleteAccountRequest, deleteAccountResponse,
  habitsSummaryResponse, quizRequest, quizResponse, schedulesResponse, startRequest, startResponse, subscriptionStatusResponse,
  type DayContent,
} from '@rabb/contracts';
import { addDays, computeStreaks, STREAK_GRACE_DAYS_PER_WEEK, validateSchedule, weekView } from '@rabb/schedule-core';
import type { VerifyJwt } from './auth.ts';
import type { Db, PrayerView, VerseView } from './db.ts';
import { ApiException, CORS_HEADERS, errorResponse, json, logRequest, parseWith, payloadHash, readJson } from './http.ts';
import type { TutorHandler } from './ai/pipeline.ts';

export interface Deps {
  db: Db;
  verifyJwt: VerifyJwt;
  now: () => Date;
  /** Deletes the auth user (and, by cascade, every user row). Production calls the Supabase Auth admin API. */
  deleteAuthUser: (userId: string) => Promise<void>;
  tutor: TutorHandler;
}

export interface Ctx {
  req: Request;
  url: URL;
  userId: string;
  requestId: string;
  deps: Deps;
}

type Handler = (ctx: Ctx) => Promise<unknown | Response>;
interface Route {
  handler: Handler;
  bucket: string;
  limit: number;
}

const WINDOW_SECONDS = 60;

function verseToApi(v: VerseView, date: string): DayContent['verse'] {
  return {
    id: v.id,
    reference: { book: v.book, chapter: v.chapter, verse_start: v.verse_start, ...(v.verse_end === null ? {} : { verse_end: v.verse_end }) },
    text: v.text,
    translation: v.translation,
    theme: v.theme,
  };
  void date;
}

function prayerToApi(p: PrayerView): DayContent['prayer'] {
  return { id: p.id, title: p.title, body: p.body, language: p.language };
}

async function requirePremium({ deps, userId }: Ctx): Promise<void> {
  if (!(await deps.db.isPremium(userId))) throw new ApiException('premium_required', 'Rabb.ai Premium is required');
}

const handlers: Record<string, Route> = {
  'GET /v1/daily/ritual': {
    bucket: 'api', limit: 120,
    handler: async ({ url, userId, deps }) => {
      const q = parseWith(dailyRitualQuery, Object.fromEntries(url.searchParams));
      const profile = await deps.db.getProfile(userId);
      const schedule = await deps.db.getSchedule(userId, q.schedule_id);
      if (!schedule) throw new ApiException('not_found', 'schedule not found');
      const translation = q.translation ?? profile.translation_code;
      const days: DayContent[] = [];
      for (let i = 0; i <= q.prefetch_days; i++) {
        const date = await deps.db.localDate(profile.timezone, i);
        const verse = await deps.db.verseFor(userId, date, profile.ui_language, translation);
        const prayer = await deps.db.prayerFor(userId, date, profile.ui_language);
        if (!verse || !prayer) {
          if (i === 0) throw new ApiException('not_found', 'no approved content for today');
          break;
        }
        days.push({ local_date: date, verse: verseToApi(verse, date), prayer: prayerToApi(prayer) });
      }
      const today = days[0] as DayContent;
      const session = await deps.db.sessionFor(userId, schedule.id, today.local_date);
      return dailyRitualResponse.parse({
        local_date: today.local_date,
        timezone: profile.timezone,
        days,
        schedule_id: schedule.id,
        timer_seconds: schedule.timer_seconds,
        session: session ? { id: session.id, status: session.status, completed_steps: session.steps } : null,
        server_time: deps.now().toISOString(),
      });
    },
  },

  'POST /v1/ritual/start': {
    bucket: 'api', limit: 120,
    handler: async ({ req, userId, deps }) => {
      const body = parseWith(startRequest, await readJson(req));
      const hash = await payloadHash(body, ['client_timestamp', 'session_id']);
      const r = await deps.db.startSession(userId, body.schedule_id, body.session_id ?? null, body.idempotency_key, hash, body.client_timestamp ?? null);
      return startResponse.parse(r);
    },
  },

  'POST /v1/ritual/complete-step': {
    bucket: 'api', limit: 120,
    handler: async ({ req, userId, deps }) => {
      const body = parseWith(completeStepRequest, await readJson(req));
      if (body.step_type === 'timer' && body.monotonic_ms === undefined) throw new ApiException('validation_failed', 'monotonic_ms: required for the timer step');
      const hash = await payloadHash(body, ['client_timestamp']);
      const r = await deps.db.completeStep(userId, body.session_id, body.step_type, body.idempotency_key, hash, body.monotonic_ms ?? null, body.offline_queued, body.client_timestamp ?? null);
      return completeStepResponse.parse(r);
    },
  },

  'POST /v1/ritual/complete': {
    bucket: 'api', limit: 120,
    handler: async ({ req, userId, deps }) => {
      const body = parseWith(completeRequest, await readJson(req));
      const hash = await payloadHash(body, ['client_timestamp']);
      const r = (await deps.db.completeSession(userId, body.session_id, body.idempotency_key, hash)) as Record<string, unknown>;
      const profile = await deps.db.getProfile(userId);
      const today = await deps.db.localDate(profile.timezone);
      const dates = await deps.db.completedDates(userId);
      const streak = computeStreaks(dates, today);
      const longest = Math.max(streak.longest, await deps.db.storedLongestStreak(userId));
      await deps.db.upsertStreak(userId, streak.current, longest, dates[0] ?? null);
      const timerVerified = await deps.db.timerVerified(userId, r.session_id as string);
      return completeResponse.parse({ ...r, timer_verified: timerVerified, current_streak: streak.current, longest_streak: longest });
    },
  },

  'GET /v1/habits/summary': {
    bucket: 'api', limit: 120,
    handler: async ({ userId, deps }) => {
      const profile = await deps.db.getProfile(userId);
      const today = await deps.db.localDate(profile.timezone);
      const dates = await deps.db.completedDates(userId);
      const streak = computeStreaks(dates, today);
      const since = addDays(today, -29);
      return habitsSummaryResponse.parse({
        local_date: today,
        current_streak: streak.current,
        longest_streak: Math.max(streak.longest, await deps.db.storedLongestStreak(userId)),
        grace_days_per_week: STREAK_GRACE_DAYS_PER_WEEK,
        week: weekView(today, streak),
        completed_last_30_days: dates.filter((d) => d >= since && d <= today).length,
        total_completed: dates.length,
      });
    },
  },

  'GET /v1/schedules': {
    bucket: 'api', limit: 120,
    handler: async ({ userId, deps }) => schedulesResponse.parse({ schedules: await deps.db.listSchedules(userId) }),
  },

  'POST /v1/schedules': {
    bucket: 'api', limit: 60,
    handler: async ({ req, userId, deps }) => {
      const body = parseWith(createScheduleRequest, await readJson(req));
      const invalid = validateSchedule({
        id: 'new', enabled: body.enabled, weekdays: body.weekdays, startMinute: body.start_minute, endMinute: body.end_minute, unlockUntil: body.unlock_until,
      });
      if (invalid) throw new ApiException('validation_failed', invalid);
      if (body.unlock_until === 'midnight' && body.end_minute <= body.start_minute) throw new ApiException('validation_failed', 'unlock_until: midnight unlock needs a window that does not cross midnight');
      if (body.kind === 'morning' && body.unlock_until !== 'window_end') throw new ApiException('validation_failed', 'unlock_until: only custom schedules may unlock until midnight');
      const { idempotency_key, ...fields } = body;
      const { row, replayed } = await deps.db.createSchedule(userId, fields, idempotency_key);
      if (replayed) {
        const same = ['name', 'kind', 'enabled', 'start_minute', 'end_minute', 'timer_seconds', 'unlock_until'].every((k) => row[k] === (fields as Record<string, unknown>)[k] || (row[k] === null && (fields as Record<string, unknown>)[k] === undefined))
          && JSON.stringify(row.weekdays) === JSON.stringify(fields.weekdays);
        if (!same) throw new ApiException('idempotency_key_reuse', 'idempotency_key_reuse');
      }
      return createScheduleResponse.parse({ ...row, replayed });
    },
  },

  'POST /v1/learning/quiz': {
    bucket: 'api', limit: 60,
    handler: async (ctx) => {
      await requirePremium(ctx);
      const body = parseWith(quizRequest, await readJson(ctx.req));
      return quizResponse.parse(await ctx.deps.db.startQuiz(ctx.userId, body.lesson_id, body.count));
    },
  },

  'POST /v1/learning/answer': {
    bucket: 'api', limit: 120,
    handler: async (ctx) => {
      await requirePremium(ctx);
      const body = parseWith(answerRequest, await readJson(ctx.req));
      const hash = await payloadHash(body, []);
      return answerResponse.parse(await ctx.deps.db.answerQuiz(ctx.userId, body.attempt_id, body.question_id, body.choice_index, body.idempotency_key, hash));
    },
  },

  'POST /v1/ai/tutor': {
    bucket: 'tutor', limit: 10,
    handler: async (ctx) => ctx.deps.tutor(ctx),
  },

  'GET /v1/subscription/status': {
    bucket: 'api', limit: 120,
    handler: async ({ userId, deps }) => {
      const row = await deps.db.subscriptionStatus(userId);
      const expires = row?.expires_at ? new Date(row.expires_at as string) : null;
      const active = !!row && ['active', 'in_grace'].includes(row.status as string) && (!expires || expires > deps.now());
      return subscriptionStatusResponse.parse({
        entitlement: active ? 'premium' : 'free',
        active,
        product_id: (row?.product_id as string | null) ?? null,
        store: (row?.store as string | null) ?? null,
        is_trial: (row?.is_trial as boolean | undefined) ?? false,
        will_renew: (row?.will_renew as boolean | null | undefined) ?? null,
        expires_at: expires ? expires.toISOString() : null,
      });
    },
  },

  'POST /v1/account/delete': {
    bucket: 'api', limit: 5,
    handler: async ({ req, userId, deps }) => {
      parseWith(deleteAccountRequest, await readJson(req));
      await deps.db.requestAccountDeletion(userId);
      await deps.deleteAuthUser(userId);
      await deps.db.completeAccountDeletion(userId);
      return deleteAccountResponse.parse({ status: 'deleted', deleted_at: deps.now().toISOString() });
    },
  },
};

export const ROUTE_KEYS = Object.keys(handlers);

/** Supabase serves the function `v1` at /functions/v1/v1/..., so the route is the longest suffix that starts with /v1/ and matches. */
function routePath(method: string, pathname: string): string {
  for (let i = pathname.indexOf('/v1/'); i >= 0; i = pathname.indexOf('/v1/', i + 1)) {
    const candidate = pathname.slice(i);
    if (handlers[`${method} ${candidate}`]) return candidate;
  }
  return pathname;
}

function translatePgError(e: unknown): ApiException | null {
  const code = (e as { code?: string } | null)?.code;
  if (code === '23505') return new ApiException('conflict', 'conflict');
  if (code === '23514' || code === '22P02' || code === '23503') return new ApiException('validation_failed', 'validation_failed');
  if (code === '42501') return new ApiException('forbidden', 'forbidden');
  return null;
}

export function createApp(deps: Deps): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const started = performance.now();
    const supplied = req.headers.get('x-request-id');
    const requestId = supplied && /^[A-Za-z0-9-]{8,64}$/.test(supplied) ? supplied : crypto.randomUUID();
    const url = new URL(req.url);
    const route = `${req.method} ${routePath(req.method, url.pathname)}`;
    let userId: string | undefined;
    let response: Response;
    try {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'x-request-id': requestId } });
      const entry = handlers[route];
      if (!entry) throw new ApiException('not_found', 'unknown route');
      const header = req.headers.get('authorization') ?? '';
      const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
      const identity = token ? await deps.verifyJwt(token) : null;
      if (!identity) throw new ApiException('unauthenticated', 'a valid access token is required');
      userId = identity.userId;
      const rl = await deps.db.consumeRateLimit(userId, entry.bucket, entry.limit, WINDOW_SECONDS);
      if (!rl.allowed) throw new ApiException('rate_limited', 'too many requests', { 'retry-after': String(WINDOW_SECONDS) });
      const result = await entry.handler({ req, url, userId, requestId, deps });
      response = result instanceof Response ? result : json(result, 200, requestId);
    } catch (e) {
      const api = e instanceof ApiException ? e : translatePgError(e) ?? new ApiException('internal', 'internal error');
      if (api.code === 'internal') console.error(JSON.stringify({ level: 'error', request_id: requestId, route, name: (e as Error)?.name }));
      response = errorResponse(api, requestId);
    }
    logRequest({ request_id: requestId, route, status: response.status, ms: Math.round(performance.now() - started), ...(userId ? { user: userId.slice(0, 8) } : {}) });
    return response;
  };
}
