import {
  addDays,
  bypassEndFor,
  computeStreaks,
  hasRolledOver,
  mondayOf,
  monthCalendar,
  nextLocalMidnight,
  nextRestrictionTime,
  offsetMs,
  resolveRestriction,
  ritualDayOf,
  ritualDayStart,
  validateSchedule,
  weekView,
  windowsBetween,
  wallToInstant,
  isValidTimeZone,
} from './index';
import type { Completion, RitualSchedule } from './index';

const Z = (iso: string): number => Date.parse(iso);
const HOUR = 3_600_000;

describe('time zone helpers', () => {
  it('validates IANA names', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
  it('computes offsets', () => {
    expect(offsetMs(Z('2026-01-15T12:00:00Z'), 'America/New_York')).toBe(-5 * HOUR);
    expect(offsetMs(Z('2026-07-15T12:00:00Z'), 'America/New_York')).toBe(-4 * HOUR);
    expect(offsetMs(Z('2026-07-15T12:00:00Z'), 'Asia/Kolkata')).toBe(5.5 * HOUR);
  });
  it('wall to instant: gap shifts forward, ambiguous takes the earlier instant', () => {
    expect(wallToInstant(Date.UTC(2026, 2, 8, 2, 30), 'America/New_York')).toBe(Z('2026-03-08T07:30:00Z')); // 03:30 EDT
    expect(wallToInstant(Date.UTC(2026, 10, 1, 1, 30), 'America/New_York')).toBe(Z('2026-11-01T05:30:00Z')); // first 01:30 (EDT)
  });
});

describe('day boundary (03:00 local)', () => {
  const NY = 'America/New_York';
  it('02:59 belongs to the previous ritual date, 03:00 to the new one', () => {
    expect(ritualDayOf(Z('2026-06-10T06:59:00Z'), NY)).toBe('2026-06-09'); // 02:59 EDT
    expect(ritualDayOf(Z('2026-06-10T07:00:00Z'), NY)).toBe('2026-06-10'); // 03:00 EDT
  });
  it('late evening stays on the same date', () => {
    expect(ritualDayOf(Z('2026-06-11T03:30:00Z'), NY)).toBe('2026-06-10'); // 23:30 EDT
  });
  it('same instant, different timezones, different ritual dates', () => {
    const t = Z('2026-06-10T10:00:00Z');
    expect(ritualDayOf(t, 'Pacific/Auckland')).toBe('2026-06-10'); // 22:00 NZST
    expect(ritualDayOf(t, 'America/Los_Angeles')).toBe('2026-06-10'); // 03:00 PDT
    expect(ritualDayOf(Z('2026-06-10T09:59:00Z'), 'America/Los_Angeles')).toBe('2026-06-09');
  });
  it('a session bound to a date does not expire from travel when the date matches', () => {
    const now = Z('2026-06-10T15:00:00Z');
    expect(hasRolledOver('2026-06-10', now, 'America/New_York')).toBe(false);
    expect(hasRolledOver('2026-06-10', now, 'Asia/Tokyo')).toBe(false); // 00:00 Jun 11 JST -> still Jun 10 by 03:00 rule
    expect(hasRolledOver('2026-06-10', Z('2026-06-10T18:00:00Z'), 'Asia/Tokyo')).toBe(true); // 03:00 Jun 11 JST
  });
  it('device clock change cannot move local_date: the function only takes the server instant', () => {
    expect(ritualDayOf.length).toBeGreaterThanOrEqual(2);
  });
});

describe('DST', () => {
  it('New York spring forward: ritual dates around 02:00 transition', () => {
    expect(ritualDayOf(Z('2026-03-08T06:59:00Z'), 'America/New_York')).toBe('2026-03-07'); // 01:59 EST
    expect(ritualDayOf(Z('2026-03-08T07:00:00Z'), 'America/New_York')).toBe('2026-03-08'); // 03:00 EDT
    const len = ritualDayStart('2026-03-08', 'America/New_York') - ritualDayStart('2026-03-07', 'America/New_York');
    expect(len).toBe(23 * HOUR);
  });
  it('New York fall back: 25 hour ritual day', () => {
    const len = ritualDayStart('2026-11-01', 'America/New_York') - ritualDayStart('2026-10-31', 'America/New_York');
    expect(len).toBe(25 * HOUR);
    expect(ritualDayOf(Z('2026-11-01T05:59:00Z'), 'America/New_York')).toBe('2026-10-31');
    expect(ritualDayOf(Z('2026-11-01T06:30:00Z'), 'America/New_York')).toBe('2026-10-31'); // 01:30 EST second pass
    expect(ritualDayOf(Z('2026-11-01T08:00:00Z'), 'America/New_York')).toBe('2026-11-01'); // 03:00 EST
  });
  it('London', () => {
    expect(ritualDayStart('2026-03-29', 'Europe/London')).toBe(Z('2026-03-29T02:00:00Z')); // 03:00 BST
    expect(ritualDayStart('2026-10-25', 'Europe/London')).toBe(Z('2026-10-25T03:00:00Z')); // 03:00 GMT
  });
  it('Lord Howe 30 minute shift', () => {
    const a = ritualDayStart('2026-10-04', 'Australia/Lord_Howe');
    const b = ritualDayStart('2026-10-03', 'Australia/Lord_Howe');
    expect(a - b).toBe(23.5 * HOUR);
  });
  it('Havana transitions at midnight: one ritual date per 03:00 boundary', () => {
    const start = ritualDayStart('2026-03-08', 'America/Havana');
    expect(ritualDayOf(start, 'America/Havana')).toBe('2026-03-08');
    expect(ritualDayOf(start - 1, 'America/Havana')).toBe('2026-03-07');
    const dates = new Set<string>();
    for (let t = ritualDayStart('2026-03-06', 'America/Havana'); t < ritualDayStart('2026-03-10', 'America/Havana'); t += 15 * 60_000) {
      dates.add(ritualDayOf(t, 'America/Havana'));
    }
    expect([...dates].sort()).toEqual(['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09']);
  });
  it('next local midnight across DST', () => {
    expect(nextLocalMidnight(Z('2026-03-07T20:00:00Z'), 'America/New_York')).toBe(Z('2026-03-08T05:00:00Z')); // 00:00 EST Mar 8
    expect(nextLocalMidnight(Z('2026-03-08T20:00:00Z'), 'America/New_York')).toBe(Z('2026-03-09T04:00:00Z')); // 00:00 EDT Mar 9
  });
});

const morning: RitualSchedule = { id: 'morning', enabled: true, weekdays: [0, 1, 2, 3, 4, 5, 6], startMinute: 5 * 60, endMinute: 12 * 60, unlockUntil: 'window_end' };
const NY = 'America/New_York';

describe('weekly recurrence', () => {
  it('weekday only schedule skips the weekend', () => {
    const wk: RitualSchedule = { ...morning, id: 'wk', weekdays: [1, 2, 3, 4, 5] };
    const ws = windowsBetween(wk, NY, Z('2026-06-05T00:00:00Z'), Z('2026-06-09T12:00:00Z')); // Fri to Tue
    const starts = ws.map((w) => new Date(w.startMs).toISOString());
    expect(starts).toEqual(['2026-06-05T09:00:00.000Z', '2026-06-08T09:00:00.000Z', '2026-06-09T09:00:00.000Z']);
  });
  it('window crossing midnight starts on its weekday', () => {
    const night: RitualSchedule = { ...morning, id: 'night', weekdays: [5], startMinute: 22 * 60, endMinute: 6 * 60 };
    const ws = windowsBetween(night, NY, Z('2026-06-05T00:00:00Z'), Z('2026-06-08T00:00:00Z'));
    expect(ws).toHaveLength(1);
    expect(new Date(ws[0]!.startMs).toISOString()).toBe('2026-06-06T02:00:00.000Z'); // Fri 22:00 EDT
    expect(new Date(ws[0]!.endMs).toISOString()).toBe('2026-06-06T10:00:00.000Z'); // Sat 06:00 EDT
  });
  it('rejects invalid schedules', () => {
    expect(validateSchedule({ ...morning, startMinute: 1440 })).not.toBeNull();
    expect(validateSchedule({ ...morning, weekdays: [] })).not.toBeNull();
    expect(validateSchedule(morning)).toBeNull();
  });
  it('disabled schedules produce no windows', () => {
    expect(windowsBetween({ ...morning, enabled: false }, NY, 0, 10 ** 12)).toEqual([]);
  });
  it('a window start in the DST gap lands after the gap', () => {
    const early: RitualSchedule = { ...morning, id: 'gap', weekdays: [0], startMinute: 150, endMinute: 240 }; // 02:30-04:00 Sunday
    const ws = windowsBetween(early, NY, Z('2026-03-08T00:00:00Z'), Z('2026-03-09T00:00:00Z'));
    expect(new Date(ws[0]!.startMs).toISOString()).toBe('2026-03-08T07:30:00.000Z'); // 03:30 EDT
  });
});

const done = (scheduleId: string, localDate: string, at: string): Completion => ({ scheduleId, localDate, completedAtMs: Z(at) });

describe('restriction resolution', () => {
  it('restricts inside a window until the ritual is complete', () => {
    const s = resolveRestriction({ nowMs: Z('2026-06-10T10:00:00Z'), timeZone: NY, schedules: [morning], completions: [] }); // 06:00 EDT
    expect(s.shouldRestrict).toBe(true);
    expect(s.reason).toBe('ritual_incomplete');
  });
  it('is not restricted outside any window', () => {
    const s = resolveRestriction({ nowMs: Z('2026-06-10T18:00:00Z'), timeZone: NY, schedules: [morning], completions: [] }); // 14:00 EDT
    expect(s).toMatchObject({ shouldRestrict: false, reason: 'no_active_window' });
  });
  it('suspends until window end after completion', () => {
    const s = resolveRestriction({
      nowMs: Z('2026-06-10T11:00:00Z'),
      timeZone: NY,
      schedules: [morning],
      completions: [done('morning', '2026-06-10', '2026-06-10T10:30:00Z')],
    });
    expect(s).toMatchObject({ shouldRestrict: false, reason: 'suspended_after_ritual' });
    expect(s.suspendedUntilMs).toBe(Z('2026-06-10T16:00:00Z')); // 12:00 EDT
  });
  it('the next day needs a new completion', () => {
    const s = resolveRestriction({
      nowMs: Z('2026-06-11T10:00:00Z'),
      timeZone: NY,
      schedules: [morning],
      completions: [done('morning', '2026-06-10', '2026-06-10T10:30:00Z')],
    });
    expect(s.shouldRestrict).toBe(true);
  });
  it('overlapping schedules: most restrictive wins', () => {
    const custom: RitualSchedule = { ...morning, id: 'custom', startMinute: 8 * 60, endMinute: 20 * 60 };
    const s = resolveRestriction({
      nowMs: Z('2026-06-10T13:00:00Z'), // 09:00 EDT, both active
      timeZone: NY,
      schedules: [morning, custom],
      completions: [done('morning', '2026-06-10', '2026-06-10T10:30:00Z')],
    });
    expect(s.shouldRestrict).toBe(true);
    expect(s.blockingScheduleIds).toEqual(['custom']);
  });
  it('unlock until midnight limits suspension to local midnight inside a window that crosses it', () => {
    const night: RitualSchedule = { ...morning, id: 'night', startMinute: 20 * 60, endMinute: 6 * 60, unlockUntil: 'midnight' };
    const completion = done('night', '2026-06-10', '2026-06-11T00:30:00Z'); // 20:30 EDT on Jun 10
    const before = resolveRestriction({ nowMs: Z('2026-06-11T03:00:00Z'), timeZone: NY, schedules: [night], completions: [completion] }); // 23:00
    expect(before.shouldRestrict).toBe(false);
    expect(before.suspendedUntilMs).toBe(Z('2026-06-11T04:00:00Z')); // 00:00 EDT Jun 11
    const after = resolveRestriction({ nowMs: Z('2026-06-11T04:30:00Z'), timeZone: NY, schedules: [night], completions: [completion] }); // 00:30
    expect(after).toMatchObject({ shouldRestrict: true, reason: 'suspension_ended' });
  });
  it('suspension also ends at the 03:00 ritual day rollover', () => {
    const night: RitualSchedule = { ...morning, id: 'night', startMinute: 20 * 60, endMinute: 6 * 60 };
    const completion = done('night', '2026-06-10', '2026-06-11T00:30:00Z');
    const s = resolveRestriction({ nowMs: Z('2026-06-11T07:30:00Z'), timeZone: NY, schedules: [night], completions: [completion] }); // 03:30 EDT Jun 11
    expect(s).toMatchObject({ shouldRestrict: true, reason: 'ritual_incomplete' });
  });
  it('emergency bypass suspends to the end of the active window', () => {
    const input = { nowMs: Z('2026-06-10T10:00:00Z'), timeZone: NY, schedules: [morning], completions: [] as Completion[] };
    const until = bypassEndFor(input);
    expect(until).toBe(Z('2026-06-10T16:00:00Z'));
    expect(resolveRestriction({ ...input, bypassUntilMs: until })).toMatchObject({ shouldRestrict: false, reason: 'emergency_bypass' });
    expect(resolveRestriction({ ...input, nowMs: Z('2026-06-11T10:00:00Z'), bypassUntilMs: until }).shouldRestrict).toBe(true);
  });
});

describe('next restriction time', () => {
  it('returns the next window start', () => {
    const r = nextRestrictionTime({ nowMs: Z('2026-03-07T20:00:00Z'), timeZone: NY, schedules: [morning], completions: [] });
    expect(r).toEqual({ atMs: Z('2026-03-08T09:00:00Z'), scheduleId: 'morning', reason: 'window_start' }); // 05:00 EDT
  });
  it('returns now when already restricted', () => {
    const now = Z('2026-06-10T10:00:00Z');
    expect(nextRestrictionTime({ nowMs: now, timeZone: NY, schedules: [morning], completions: [] })).toMatchObject({ atMs: now, reason: 'already_restricted' });
  });
  it('skips a window whose ritual date is already completed', () => {
    const r = nextRestrictionTime({
      nowMs: Z('2026-06-10T18:00:00Z'),
      timeZone: NY,
      schedules: [morning],
      completions: [done('morning', '2026-06-11', '2026-06-10T17:00:00Z')], // completed early for tomorrow's ritual date
    });
    expect(new Date(r!.atMs).toISOString()).toBe('2026-06-12T09:00:00.000Z');
  });
  it('reports the end of a midnight suspension as the next restriction', () => {
    const night: RitualSchedule = { ...morning, id: 'night', startMinute: 20 * 60, endMinute: 6 * 60, unlockUntil: 'midnight' };
    const r = nextRestrictionTime({
      nowMs: Z('2026-06-11T03:00:00Z'),
      timeZone: NY,
      schedules: [night],
      completions: [done('night', '2026-06-10', '2026-06-11T00:30:00Z')],
    });
    expect(r).toMatchObject({ atMs: Z('2026-06-11T04:00:00Z'), reason: 'suspension_ended' });
  });
  it('timezone travel: the same schedule moves with the profile timezone', () => {
    const ny = nextRestrictionTime({ nowMs: Z('2026-06-10T18:00:00Z'), timeZone: NY, schedules: [morning], completions: [] });
    const tokyo = nextRestrictionTime({ nowMs: Z('2026-06-10T18:00:00Z'), timeZone: 'Asia/Tokyo', schedules: [morning], completions: [] });
    expect(new Date(ny!.atMs).toISOString()).toBe('2026-06-11T09:00:00.000Z');
    expect(new Date(tokyo!.atMs).toISOString()).toBe('2026-06-10T20:00:00.000Z'); // 05:00 JST Jun 11
  });
  it('returns null with no schedules', () => {
    expect(nextRestrictionTime({ nowMs: 0, timeZone: NY, schedules: [], completions: [] })).toBeNull();
  });
});

describe('streaks', () => {
  const week = (...d: number[]) => d.map((n) => `2026-03-${String(n).padStart(2, '0')}`);
  // 2026-03-02 is a Monday
  it('empty history', () => {
    expect(computeStreaks([], '2026-03-05')).toMatchObject({ current: 0, longest: 0 });
  });
  it('consecutive days', () => {
    const r = computeStreaks(week(2, 3, 4, 5, 6, 7, 8), '2026-03-08');
    expect(r).toMatchObject({ current: 7, longest: 7 });
  });
  it('today pending does not break the streak', () => {
    const r = computeStreaks(week(2, 3, 4), '2026-03-05');
    expect(r.current).toBe(3);
    expect(r.days['2026-03-05']).toBe('pending');
  });
  it('one missed day per week is forgiven', () => {
    const r = computeStreaks(week(2, 3, 5, 6, 7, 8), '2026-03-08');
    expect(r.current).toBe(6);
    expect(r.graceDates).toEqual(['2026-03-04']);
    expect(r.days['2026-03-04']).toBe('grace');
  });
  it('two misses in the same week break the streak', () => {
    const r = computeStreaks(week(2, 3, 6, 7, 8), '2026-03-08');
    expect(r.current).toBe(3);
    expect(r.longest).toBe(3);
    expect(r.days['2026-03-05']).toBe('missed');
  });
  it('longest streak is retained after a break', () => {
    const r = computeStreaks(week(2, 3, 4, 5, 6, 7, 8).concat(['2026-03-12']), '2026-03-12');
    // Mar 9, 10, 11: Mar 9 grace (week of Mar 9), Mar 10 missed -> break
    expect(r.longest).toBe(7);
    expect(r.current).toBe(1);
  });
  it('grace allowance resets each calendar week', () => {
    const r = computeStreaks(['2026-03-02', '2026-03-04', '2026-03-09', '2026-03-11'], '2026-03-12'); // miss Mar 3 (wk1), Mar 5-8, ...
    expect(r.days['2026-03-03']).toBe('grace');
    expect(r.days['2026-03-05']).toBe('missed'); // second miss in week 1 breaks
  });
  it('trailing misses beyond the allowance zero the current streak', () => {
    const r = computeStreaks(week(2, 3), '2026-03-06'); // Mar 4 grace, Mar 5 missed
    expect(r.current).toBe(0);
    expect(r.longest).toBe(2);
  });
  it('configurable grace constant', () => {
    expect(computeStreaks(week(2, 5), '2026-03-05', 0).current).toBe(1);
    expect(computeStreaks(week(2, 5), '2026-03-05', 2).current).toBe(2);
  });
  it('ignores future dates', () => {
    expect(computeStreaks(['2026-03-02', '2026-03-20'], '2026-03-03').current).toBe(1);
  });
  it('week view and month calendar', () => {
    const r = computeStreaks(week(2, 3, 5), '2026-03-05');
    const wv = weekView('2026-03-04', r);
    expect(wv.map((x) => x.date)[0]).toBe('2026-03-02');
    expect(wv.map((x) => x.status)).toEqual(['completed', 'completed', 'grace', 'completed', 'none', 'none', 'none']);
    const cal = monthCalendar(2026, 3, r);
    expect(cal[0]!.slice(0, 6)).toEqual([null, null, null, null, null, null]); // 2026-03-01 is a Sunday
    expect(cal[0]![6]).toEqual({ date: '2026-03-01', status: 'none' });
    expect(cal[1]![0]).toEqual({ date: '2026-03-02', status: 'completed' });
  });
  it('date helpers', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(mondayOf('2026-03-08')).toBe('2026-03-02');
  });
});
