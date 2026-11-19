import {
  completeResponse, completeStepResponse, createScheduleResponse, dailyRitualResponse, habitsSummaryResponse,
  schedulesResponse, startResponse, subscriptionStatusResponse, deleteAccountResponse,
} from '@rabb/contracts';
import { addDays, computeStreaks, fallbackIndexForDemo, ritualDayOf, STREAK_GRACE_DAYS_PER_WEEK, weekView } from './util';
import type { ZodTypeAny, z } from 'zod';
import { ApiError, type ApiClient } from '../services/api/client';
import { getJson, setJson, type KeyValueStore } from '../services/storage/kv';
import { uuidv4 } from '../utils/id';
import { DEMO_PRAYERS, DEMO_TRANSLATION, DEMO_VERSES } from './fixtures';

interface Session { id: string; scheduleId: string; localDate: string; status: 'in_progress' | 'completed'; timerSeconds: number | null; steps: string[]; timerVerified: boolean | null; completedAt?: string }
interface Sched { id: string; name: string; kind: 'morning' | 'custom'; enabled: boolean; weekdays: number[]; start_minute: number; end_minute: number; timer_seconds: number | null; unlock_until: 'window_end' | 'midnight'; key: string }

const SESSIONS = 'demo.sessions.v1';
const SCHEDULES = 'demo.schedules.v1';

const fail = (code: ConstructorParameters<typeof ApiError>[0], status: number, message: string) => new ApiError(code, status, message, 'demo');

/**
 * DEMO MODE ONLY. A local stand-in for the /v1 API so the whole ritual runs without a backend. It follows the same contracts
 * (responses are parsed with the shared Zod schemas) and the same ordering rules, but nothing is verified by a server:
 * timer_verified is reported as false, and the UI labels the build as a demo.
 */
export function createDemoApi(kv: KeyValueStore, timeZone: () => string, nowMs: () => number = Date.now): ApiClient {
  const today = () => ritualDayOf(nowMs(), timeZone());
  const sessions = () => getJson<Session[]>(kv, SESSIONS, []);
  const saveSessions = (s: Session[]) => setJson(kv, SESSIONS, s);
  const schedules = () => getJson<Sched[]>(kv, SCHEDULES, []);
  const strip = ({ key: _k, ...s }: Sched) => { void _k; return s; };
  const completedDates = () => Array.from(new Set(sessions().filter((s) => s.status === 'completed').map((s) => s.localDate)));

  const dayContent = (date: string) => {
    const v = DEMO_VERSES[fallbackIndexForDemo(date, DEMO_VERSES.length)] as (typeof DEMO_VERSES)[number];
    const p = DEMO_PRAYERS[fallbackIndexForDemo(date, DEMO_PRAYERS.length)] as (typeof DEMO_PRAYERS)[number];
    return {
      local_date: date,
      verse: { id: v.id, reference: { book: v.book, chapter: v.chapter, verse_start: v.verse_start, ...(v.verse_end ? { verse_end: v.verse_end } : {}) }, text: v.text, translation: DEMO_TRANSLATION, theme: v.theme },
      prayer: { id: p.id, title: p.title, body: p.body, language: 'en' },
    };
  };

  const handle = (method: 'GET' | 'POST', path: string, body: Record<string, unknown>, query: Record<string, string | number | undefined>): unknown => {
    const route = `${method} ${path}`;
    switch (route) {
      case 'GET /v1/daily/ritual': {
        const morning = schedules().find((s) => s.kind === 'morning') ?? null;
        const prefetch = Number(query.prefetch_days ?? 7);
        const d0 = today();
        const sess = morning ? sessions().find((s) => s.scheduleId === morning.id && s.localDate === d0) : undefined;
        return {
          local_date: d0, timezone: timeZone(), days: Array.from({ length: prefetch + 1 }, (_, i) => dayContent(addDays(d0, i))),
          schedule_id: morning?.id ?? null, timer_seconds: morning?.timer_seconds ?? null,
          session: sess ? { id: sess.id, status: sess.status, completed_steps: sess.steps } : null, server_time: new Date(nowMs()).toISOString(),
        };
      }
      case 'GET /v1/schedules':
        return { schedules: schedules().map(strip) };
      case 'POST /v1/schedules': {
        const key = String(body.idempotency_key);
        const existing = schedules().find((s) => s.key === key);
        if (existing) return { ...strip(existing), replayed: true };
        if (body.kind === 'morning' && schedules().some((s) => s.kind === 'morning')) throw fail('conflict', 409, 'a morning schedule already exists');
        const { idempotency_key: _i, ...fields } = body;
        void _i;
        const row = { ...(fields as Omit<Sched, 'id' | 'key'>), id: uuidv4(), key };
        setJson(kv, SCHEDULES, [...schedules(), row]);
        return { ...strip(row), replayed: false };
      }
      case 'POST /v1/ritual/start': {
        const sch = schedules().find((s) => s.id === body.schedule_id);
        if (!sch) throw fail('not_found', 404, 'schedule not found');
        const d = today();
        const found = sessions().find((s) => s.scheduleId === sch.id && s.localDate === d);
        const s: Session = found ?? { id: (body.session_id as string) ?? uuidv4(), scheduleId: sch.id, localDate: d, status: 'in_progress', timerSeconds: sch.timer_seconds, steps: [], timerVerified: null };
        if (!found) saveSessions([...sessions(), s]);
        return { session_id: s.id, local_date: s.localDate, status: s.status, timer_seconds: s.timerSeconds, replayed: !!found };
      }
      case 'POST /v1/ritual/complete-step': {
        const all = sessions();
        const s = all.find((x) => x.id === body.session_id);
        if (!s) throw fail('not_found', 404, 'session not found');
        const step = body.step_type as string;
        if (!s.steps.includes(step)) {
          if (step === 'prayer' && !s.steps.includes('scripture')) throw fail('illegal_transition', 409, 'scripture first');
          if (step === 'timer') {
            if (s.timerSeconds === null) throw fail('illegal_transition', 409, 'timer not configured');
            if (!s.steps.includes('prayer')) throw fail('illegal_transition', 409, 'prayer first');
            if (typeof body.monotonic_ms !== 'number' || body.monotonic_ms < s.timerSeconds * 1000) throw fail('timer_invalid', 422, 'timer too short');
            s.timerVerified = false; // demo mode: no server time to verify against
          }
          s.steps.push(step);
          saveSessions(all);
        }
        return { session_id: s.id, step_type: step, completed_steps: s.steps, timer_verified: step === 'timer' ? s.timerVerified : null, replayed: false };
      }
      case 'POST /v1/ritual/complete': {
        const all = sessions();
        const s = all.find((x) => x.id === body.session_id);
        if (!s) throw fail('not_found', 404, 'session not found');
        if (s.status !== 'completed') {
          if (!s.steps.includes('scripture') || !s.steps.includes('prayer')) throw fail('illegal_transition', 409, 'steps missing');
          if (s.timerSeconds !== null && !s.steps.includes('timer')) throw fail('illegal_transition', 409, 'timer missing');
          s.status = 'completed';
          s.completedAt = new Date(nowMs()).toISOString();
          saveSessions(all);
        }
        const st = computeStreaks(completedDates(), today());
        return { session_id: s.id, local_date: s.localDate, status: 'completed', completed_at: s.completedAt, timer_verified: s.timerSeconds === null ? null : (s.timerVerified ?? false), first_completion_won: true, current_streak: st.current, longest_streak: st.longest, replayed: false };
      }
      case 'GET /v1/habits/summary': {
        const t = today();
        const st = computeStreaks(completedDates(), t);
        const since = addDays(t, -29);
        return { local_date: t, current_streak: st.current, longest_streak: st.longest, grace_days_per_week: STREAK_GRACE_DAYS_PER_WEEK, week: weekView(t, st), completed_last_30_days: completedDates().filter((d) => d >= since && d <= t).length, total_completed: completedDates().length };
      }
      case 'GET /v1/subscription/status':
        return { entitlement: 'free', active: false, product_id: null, store: null, is_trial: false, will_renew: null, expires_at: null };
      case 'POST /v1/account/delete':
        for (const k of kv.keys()) if (k.startsWith('demo.')) kv.delete(k);
        return { status: 'deleted', deleted_at: new Date(nowMs()).toISOString() };
      default:
        // Learning, quizzes and the tutor need the server and billing, which are not active in demo mode.
        throw fail('premium_required', 403, 'not available in demo mode');
    }
  };

  const known = { dailyRitualResponse, schedulesResponse, createScheduleResponse, startResponse, completeStepResponse, completeResponse, habitsSummaryResponse, subscriptionStatusResponse, deleteAccountResponse };
  void known;

  return {
    get: async <S extends ZodTypeAny>(path: string, schema: S, query: Record<string, string | number | undefined> = {}) =>
      schema.parse(handle('GET', path, {}, query)) as z.infer<S>,
    post: async <S extends ZodTypeAny>(path: string, body: unknown, schema: S) =>
      schema.parse(handle('POST', path, (body ?? {}) as Record<string, unknown>, {})) as z.infer<S>,
  };
}
