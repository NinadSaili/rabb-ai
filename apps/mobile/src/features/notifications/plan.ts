import { nextRitualDayStart, ritualDayOf, windowsBetween, type Completion, type RitualSchedule } from '@rabb/schedule-core';

export interface ReminderSettings {
  morningReminder: boolean;
  missedNudge: boolean;
}

export type ReminderKind = 'morning_reminder' | 'missed_nudge';

export interface PlannedReminder {
  /** Stable id so rescheduling replaces instead of duplicating. */
  id: string;
  kind: ReminderKind;
  atMs: number;
  scheduleId: string;
}

export const MISSED_NUDGE_DELAY_MS = 3 * 60 * 60 * 1000;
const HORIZON_DAYS = 7;

/**
 * Plans local notifications (no remote push in v1). Gentle by design:
 * - morning reminder at the start of each upcoming window of the morning schedule, only if that ritual date is not yet complete
 * - missed ritual nudge 3 hours after a window start, at most one per ritual date, only when the user enabled it
 * Both are user controlled. Notification text never contains scripture, prayer text or app names.
 */
export function planReminders(input: {
  nowMs: number;
  timeZone: string;
  schedules: (RitualSchedule & { kind?: 'morning' | 'custom' })[];
  completions: Completion[];
  settings: ReminderSettings;
}): PlannedReminder[] {
  const { nowMs, timeZone, schedules, completions, settings } = input;
  const out: PlannedReminder[] = [];
  if (!settings.morningReminder && !settings.missedNudge) return out;
  const horizon = nowMs + HORIZON_DAYS * 86_400_000;
  for (const s of schedules) {
    for (const w of windowsBetween(s, timeZone, nowMs, horizon)) {
      const date = ritualDayOf(w.startMs, timeZone);
      const done = completions.some((c) => c.scheduleId === s.id && c.localDate === date);
      if (done) continue;
      if (settings.morningReminder && s.kind !== 'custom' && w.startMs > nowMs) {
        out.push({ id: `m-${s.id}-${date}`, kind: 'morning_reminder', atMs: w.startMs, scheduleId: s.id });
      }
      const nudge = w.startMs + MISSED_NUDGE_DELAY_MS;
      if (settings.missedNudge && nudge > nowMs && nudge < w.endMs && nudge < nextRitualDayStart(w.startMs, timeZone)) {
        out.push({ id: `n-${s.id}-${date}`, kind: 'missed_nudge', atMs: nudge, scheduleId: s.id });
      }
    }
  }
  return out.sort((a, b) => a.atMs - b.atMs);
}
