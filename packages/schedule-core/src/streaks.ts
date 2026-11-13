import { addDays, daysBetween, mondayOf } from './day';

/** One missed day per calendar week (Monday to Sunday) keeps a streak alive. Documented in PRODUCT_REQUIREMENTS R-STREAK. */
export const STREAK_GRACE_DAYS_PER_WEEK = 1;

export type DayStatus = 'completed' | 'grace' | 'missed' | 'pending';

export interface StreakResult {
  current: number;
  longest: number;
  /** Status per ritual date from the first completion through today. */
  days: Record<string, DayStatus>;
  graceDates: string[];
}

export function computeStreaks(
  completedDates: readonly string[],
  today: string,
  graceDaysPerWeek: number = STREAK_GRACE_DAYS_PER_WEEK,
): StreakResult {
  const done = new Set(completedDates.filter((d) => d <= today));
  const result: StreakResult = { current: 0, longest: 0, days: {}, graceDates: [] };
  if (done.size === 0) return result;
  const first = [...done].sort()[0] as string;
  const graceUsed = new Map<string, number>();
  let streak = 0;
  for (let d = first, n = daysBetween(first, today); n >= 0; d = addDays(d, 1), n--) {
    if (done.has(d)) {
      streak += 1;
      result.longest = Math.max(result.longest, streak);
      result.days[d] = 'completed';
    } else if (d === today) {
      result.days[d] = 'pending';
    } else {
      const week = mondayOf(d);
      const used = graceUsed.get(week) ?? 0;
      if (streak > 0 && used < graceDaysPerWeek) {
        graceUsed.set(week, used + 1);
        result.days[d] = 'grace';
        result.graceDates.push(d);
      } else {
        streak = 0;
        result.days[d] = 'missed';
      }
    }
  }
  result.current = streak;
  return result;
}

/** Seven entries Monday to Sunday for the week containing `date`. */
export function weekView(date: string, streak: StreakResult): { date: string; status: DayStatus | 'none' }[] {
  const monday = mondayOf(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    return { date: d, status: streak.days[d] ?? 'none' };
  });
}

/** Completion calendar for a month, weeks as rows (Monday first), null for padding days. */
export function monthCalendar(year: number, month: number, streak: StreakResult): ({ date: string; status: DayStatus | 'none' } | null)[][] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: ({ date: string; status: DayStatus | 'none' } | null)[] = Array(lead).fill(null);
  for (let i = 0; i < daysInMonth; i++) {
    const d = addDays(first, i);
    cells.push({ date: d, status: streak.days[d] ?? 'none' });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
