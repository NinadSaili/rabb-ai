/** Time zone helpers built on Intl only (no dependencies). All instants are epoch milliseconds. */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function wallClockAt(instantMs: number, timeZone: string): WallClock {
  const parts = formatter(timeZone).formatToParts(new Date(instantMs));
  const get = (type: string): number => {
    const p = parts.find((x) => x.type === type);
    return p ? Number(p.value) : NaN;
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Wall clock reading of an instant, expressed as if it were UTC milliseconds. */
export function wallUtcMs(instantMs: number, timeZone: string): number {
  const w = wallClockAt(instantMs, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
}

/** UTC offset in milliseconds at an instant (positive east of UTC). */
export function offsetMs(instantMs: number, timeZone: string): number {
  return wallUtcMs(instantMs, timeZone) - Math.floor(instantMs / 1000) * 1000;
}

const DAY_MS = 86_400_000;

/**
 * Converts a wall clock reading (as UTC milliseconds) to an instant.
 * Ambiguous times (clocks set back) resolve to the earlier instant.
 * Nonexistent times (clocks set forward) resolve to the same offset-before reading, which lands after the gap.
 */
export function wallToInstant(wallMs: number, timeZone: string): number {
  const before = offsetMs(wallMs - DAY_MS, timeZone);
  const after = offsetMs(wallMs + DAY_MS, timeZone);
  const candidates = Array.from(new Set([wallMs - before, wallMs - after]));
  const valid = candidates.filter((c) => c + offsetMs(c, timeZone) === wallMs).sort((a, b) => a - b);
  if (valid.length > 0) return valid[0] as number;
  return wallMs - before;
}
