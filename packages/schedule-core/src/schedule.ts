import { addDays, nextLocalMidnight, nextRitualDayStart, parseDate, ritualDayOf, weekdayOf } from './day.ts';
import { wallToInstant } from './tz.ts';

export type UnlockUntil = 'window_end' | 'midnight';

export interface RitualSchedule {
  id: string;
  enabled: boolean;
  /** 0 = Sunday ... 6 = Saturday. The weekday is the one the window starts on. */
  weekdays: number[];
  /** Minutes after local midnight, 0..1439. */
  startMinute: number;
  /** 1..1440. A value less than or equal to startMinute means the window ends on the next calendar day. */
  endMinute: number;
  unlockUntil: UnlockUntil;
}

export interface RestrictionWindow {
  scheduleId: string;
  startMs: number;
  endMs: number;
}

export interface Completion {
  scheduleId: string;
  localDate: string;
  completedAtMs: number;
}

export function validateSchedule(s: RitualSchedule): string | null {
  if (!Number.isInteger(s.startMinute) || s.startMinute < 0 || s.startMinute > 1439) return 'startMinute must be 0..1439';
  if (!Number.isInteger(s.endMinute) || s.endMinute < 1 || s.endMinute > 1440) return 'endMinute must be 1..1440';
  if (s.weekdays.length === 0 || s.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return 'weekdays must be 0..6 and not empty';
  return null;
}

function windowFor(s: RitualSchedule, date: string, timeZone: string): RestrictionWindow {
  const { year, month, day } = parseDate(date);
  const crossesMidnight = s.endMinute <= s.startMinute;
  const startMs = wallToInstant(Date.UTC(year, month - 1, day, 0, s.startMinute), timeZone);
  const endMs = wallToInstant(Date.UTC(year, month - 1, day + (crossesMidnight ? 1 : 0), 0, s.endMinute), timeZone);
  return { scheduleId: s.id, startMs, endMs };
}

/** Windows of one schedule that overlap [fromMs, toMs]. Weekly recurrence, DST aware. */
export function windowsBetween(s: RitualSchedule, timeZone: string, fromMs: number, toMs: number): RestrictionWindow[] {
  if (!s.enabled || validateSchedule(s) !== null) return [];
  const firstDate = addDays(ritualDayOf(fromMs, timeZone), -2);
  const lastDate = addDays(ritualDayOf(toMs, timeZone), 1);
  const out: RestrictionWindow[] = [];
  for (let d = firstDate; d <= lastDate; d = addDays(d, 1)) {
    if (!s.weekdays.includes(weekdayOf(d))) continue;
    const w = windowFor(s, d, timeZone);
    if (w.endMs > fromMs && w.startMs < toMs) out.push(w);
  }
  return out;
}

export type RestrictionReason =
  | 'no_active_window'
  | 'ritual_incomplete'
  | 'suspension_ended'
  | 'suspended_after_ritual'
  | 'emergency_bypass';

export interface RestrictionStatus {
  /** Policy answer. The UI may say "locked" only after the native layer confirms the restriction is applied. */
  shouldRestrict: boolean;
  reason: RestrictionReason;
  blockingScheduleIds: string[];
  /** Earliest instant at which this answer can change because a suspension ends. */
  suspendedUntilMs: number | null;
}

export interface RestrictionInput {
  nowMs: number;
  timeZone: string;
  schedules: RitualSchedule[];
  completions: Completion[];
  /** Emergency bypass end instant, or null. */
  bypassUntilMs?: number | null;
}

/** End of the suspension that a completion buys inside a window. */
function suspensionEnd(s: RitualSchedule, w: RestrictionWindow, c: Completion, timeZone: string): number {
  let end = Math.min(w.endMs, nextRitualDayStart(c.completedAtMs, timeZone));
  if (s.unlockUntil === 'midnight') end = Math.min(end, nextLocalMidnight(c.completedAtMs, timeZone));
  return end;
}

/**
 * Overlap resolution: most restrictive wins. Restricted when any active window has no valid completion for the current ritual date.
 */
export function resolveRestriction(input: RestrictionInput): RestrictionStatus {
  const { nowMs, timeZone, schedules, completions } = input;
  const today = ritualDayOf(nowMs, timeZone);
  const active: { s: RitualSchedule; w: RestrictionWindow }[] = [];
  for (const s of schedules) {
    for (const w of windowsBetween(s, timeZone, nowMs, nowMs + 1)) {
      if (w.startMs <= nowMs && nowMs < w.endMs) active.push({ s, w });
    }
  }
  if (active.length === 0) return { shouldRestrict: false, reason: 'no_active_window', blockingScheduleIds: [], suspendedUntilMs: null };

  if (input.bypassUntilMs != null && nowMs < input.bypassUntilMs) {
    return { shouldRestrict: false, reason: 'emergency_bypass', blockingScheduleIds: [], suspendedUntilMs: input.bypassUntilMs };
  }

  const blocking: string[] = [];
  let reason: RestrictionReason = 'suspended_after_ritual';
  let earliestSuspendEnd: number | null = null;
  for (const { s, w } of active) {
    const c = completions.find((x) => x.scheduleId === s.id && x.localDate === today);
    if (!c) {
      blocking.push(s.id);
      reason = 'ritual_incomplete';
      continue;
    }
    const end = suspensionEnd(s, w, c, timeZone);
    if (nowMs < end) {
      earliestSuspendEnd = earliestSuspendEnd === null ? end : Math.min(earliestSuspendEnd, end);
    } else {
      blocking.push(s.id);
      if (reason !== 'ritual_incomplete') reason = 'suspension_ended';
    }
  }
  if (blocking.length > 0) return { shouldRestrict: true, reason, blockingScheduleIds: blocking, suspendedUntilMs: null };
  return { shouldRestrict: false, reason: 'suspended_after_ritual', blockingScheduleIds: [], suspendedUntilMs: earliestSuspendEnd };
}

export interface NextRestriction {
  atMs: number;
  scheduleId: string;
  reason: 'already_restricted' | 'suspension_ended' | 'window_start';
}

/** Instant at which restrictions next begin (or now when already restricted). Looks ahead 14 days. */
export function nextRestrictionTime(input: RestrictionInput, lookaheadDays = 14): NextRestriction | null {
  const { nowMs, timeZone, schedules, completions } = input;
  const status = resolveRestriction(input);
  if (status.shouldRestrict) {
    return { atMs: nowMs, scheduleId: status.blockingScheduleIds[0] as string, reason: 'already_restricted' };
  }
  let best: NextRestriction | null = null;
  const consider = (c: NextRestriction) => {
    if (best === null || c.atMs < best.atMs) best = c;
  };
  const horizon = nowMs + lookaheadDays * 86_400_000;
  for (const s of schedules) {
    for (const w of windowsBetween(s, timeZone, nowMs, horizon)) {
      if (w.startMs <= nowMs && nowMs < w.endMs) {
        const today = ritualDayOf(nowMs, timeZone);
        const c = completions.find((x) => x.scheduleId === s.id && x.localDate === today);
        if (c) {
          const end = suspensionEnd(s, w, c, timeZone);
          if (end < w.endMs && end > nowMs) consider({ atMs: end, scheduleId: s.id, reason: 'suspension_ended' });
        }
        continue;
      }
      if (w.startMs <= nowMs) continue;
      const done = completions.some((x) => x.scheduleId === s.id && x.localDate === ritualDayOf(w.startMs, timeZone));
      if (!done) consider({ atMs: w.startMs, scheduleId: s.id, reason: 'window_start' });
    }
  }
  return best;
}

/**
 * End instant for an emergency bypass. It always returns a value, so the bypass works even when no schedule is loaded
 * (cold start from the block screen, offline, schedules not synced): the end of the latest active window, else the next ritual day start.
 */
export function bypassUntil(input: RestrictionInput): number {
  return bypassEndFor(input) ?? nextRitualDayStart(input.nowMs, input.timeZone);
}

/** End instant to store for an emergency bypass: the end of the latest currently active window. */
export function bypassEndFor(input: RestrictionInput): number | null {
  const { nowMs, timeZone, schedules } = input;
  let end: number | null = null;
  for (const s of schedules) {
    for (const w of windowsBetween(s, timeZone, nowMs, nowMs + 1)) {
      if (w.startMs <= nowMs && nowMs < w.endMs) end = end === null ? w.endMs : Math.max(end, w.endMs);
    }
  }
  return end;
}

/**
 * Instant until which restrictions stay suspended after a ritual completion, so the OS layer does not re-apply
 * them for windows of the same ritual date. Covers completion before, during or across a window.
 * Returns null when no window of the schedule remains in the current ritual date.
 */
export function suspensionAfterCompletion(input: { nowMs: number; timeZone: string; schedule: RitualSchedule }): number | null {
  const { nowMs, timeZone, schedule } = input;
  const dayEnd = nextRitualDayStart(nowMs, timeZone);
  let best: number | null = null;
  for (const w of windowsBetween(schedule, timeZone, nowMs, dayEnd)) {
    if (w.endMs <= nowMs || w.startMs >= dayEnd) continue;
    let end = Math.min(w.endMs, dayEnd);
    if (schedule.unlockUntil === 'midnight') end = Math.min(end, nextLocalMidnight(nowMs, timeZone));
    if (end > nowMs) best = best === null ? end : Math.max(best, end);
  }
  return best;
}
