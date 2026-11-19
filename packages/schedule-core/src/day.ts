import { wallClockAt, wallToInstant } from './tz.ts';

/** Ritual day starts at 03:00 local wall clock time (see PRODUCT_REQUIREMENTS R-DAY). */
export const RITUAL_DAY_START_HOUR = 3;

const pad = (n: number): string => String(n).padStart(2, '0');

export function formatDate(utcMs: number): string {
  const d = new Date(utcMs);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function parseDate(date: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new RangeError(`Invalid date ${date}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function dateToUtcMs(date: string): number {
  const { year, month, day } = parseDate(date);
  return Date.UTC(year, month - 1, day);
}

export function addDays(date: string, days: number): string {
  return formatDate(dateToUtcMs(date) + days * 86_400_000);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayOf(date: string): number {
  return new Date(dateToUtcMs(date)).getUTCDay();
}

/** Monday of the calendar week (Monday to Sunday) that contains the date. */
export function mondayOf(date: string): string {
  const wd = weekdayOf(date);
  return addDays(date, -((wd + 6) % 7));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dateToUtcMs(to) - dateToUtcMs(from)) / 86_400_000);
}

/**
 * Server side ritual date: wall clock minus the day start hour, in the profile timezone.
 * The client clock is never an input to anything that persists.
 */
export function ritualDayOf(instantMs: number, timeZone: string, dayStartHour: number = RITUAL_DAY_START_HOUR): string {
  const w = wallClockAt(instantMs, timeZone);
  return formatDate(Date.UTC(w.year, w.month - 1, w.day, w.hour - dayStartHour, w.minute, w.second));
}

/** Instant at which a ritual date begins (03:00 local wall clock of that calendar date). */
export function ritualDayStart(date: string, timeZone: string, dayStartHour: number = RITUAL_DAY_START_HOUR): number {
  const { year, month, day } = parseDate(date);
  return wallToInstant(Date.UTC(year, month - 1, day, dayStartHour, 0, 0), timeZone);
}

export function nextRitualDayStart(instantMs: number, timeZone: string): number {
  return ritualDayStart(addDays(ritualDayOf(instantMs, timeZone), 1), timeZone);
}

/** Next local calendar midnight strictly after the instant. */
export function nextLocalMidnight(instantMs: number, timeZone: string): number {
  const w = wallClockAt(instantMs, timeZone);
  return wallToInstant(Date.UTC(w.year, w.month - 1, w.day + 1, 0, 0, 0), timeZone);
}

/**
 * True when an unfinished session bound to sessionLocalDate must expire.
 * The comparison uses the current timezone, so travel can only expire a session through a real date change.
 */
export function hasRolledOver(sessionLocalDate: string, nowMs: number, timeZone: string): boolean {
  return ritualDayOf(nowMs, timeZone) !== sessionLocalDate;
}
