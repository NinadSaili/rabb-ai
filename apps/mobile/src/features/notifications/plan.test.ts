import type { Completion, RitualSchedule } from '@rabb/schedule-core';
import { MISSED_NUDGE_DELAY_MS, planReminders } from './plan';

const Z = (iso: string) => Date.parse(iso);
const NY = 'America/New_York';
const morning: RitualSchedule & { kind: 'morning' } = { id: 'm', kind: 'morning', enabled: true, weekdays: [0, 1, 2, 3, 4, 5, 6], startMinute: 7 * 60, endMinute: 12 * 60, unlockUntil: 'window_end' };
const on = { morningReminder: true, missedNudge: true };

describe('planReminders', () => {
  it('plans one morning reminder per upcoming window and one nudge per date', () => {
    const plan = planReminders({ nowMs: Z('2026-06-10T04:00:00Z'), timeZone: NY, schedules: [morning], completions: [], settings: on });
    const reminders = plan.filter((p) => p.kind === 'morning_reminder');
    expect(reminders[0]?.atMs).toBe(Z('2026-06-10T11:00:00Z')); // 07:00 EDT
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
    const nudge = plan.find((p) => p.kind === 'missed_nudge');
    expect(nudge?.atMs).toBe(Z('2026-06-10T11:00:00Z') + MISSED_NUDGE_DELAY_MS);
  });
  it('skips dates whose ritual is already complete', () => {
    const completions: Completion[] = [{ scheduleId: 'm', localDate: '2026-06-10', completedAtMs: Z('2026-06-10T05:00:00Z') }];
    const plan = planReminders({ nowMs: Z('2026-06-10T04:00:00Z'), timeZone: NY, schedules: [morning], completions, settings: on });
    expect(plan.some((p) => p.id.endsWith('2026-06-10'))).toBe(false);
    expect(plan.some((p) => p.id.endsWith('2026-06-11'))).toBe(true);
  });
  it('respects user controls', () => {
    const base = { nowMs: Z('2026-06-10T04:00:00Z'), timeZone: NY, schedules: [morning], completions: [] as Completion[] };
    expect(planReminders({ ...base, settings: { morningReminder: false, missedNudge: false } })).toEqual([]);
    expect(planReminders({ ...base, settings: { morningReminder: true, missedNudge: false } }).every((p) => p.kind === 'morning_reminder')).toBe(true);
    expect(planReminders({ ...base, settings: { morningReminder: false, missedNudge: true } }).every((p) => p.kind === 'missed_nudge')).toBe(true);
  });
  it('never schedules in the past and plans at most 7 days ahead', () => {
    const now = Z('2026-06-10T15:00:00Z'); // after today's window start
    const plan = planReminders({ nowMs: now, timeZone: NY, schedules: [morning], completions: [], settings: on });
    expect(plan.every((p) => p.atMs > now)).toBe(true);
    expect(plan.every((p) => p.atMs <= now + 8 * 86_400_000)).toBe(true);
  });
  it('does not send a morning reminder for custom schedules', () => {
    const custom = { ...morning, id: 'c', kind: 'custom' as const };
    const plan = planReminders({ nowMs: Z('2026-06-10T04:00:00Z'), timeZone: NY, schedules: [custom], completions: [], settings: { morningReminder: true, missedNudge: false } });
    expect(plan).toEqual([]);
  });
  it('follows DST: a 07:00 window is 07:00 local both sides of the change', () => {
    const plan = planReminders({ nowMs: Z('2026-03-07T12:00:00Z'), timeZone: NY, schedules: [morning], completions: [], settings: { morningReminder: true, missedNudge: false } });
    expect(plan[0]?.atMs).toBe(Z('2026-03-08T11:00:00Z')); // 07:00 EDT after spring forward
    expect((plan[1]?.atMs ?? 0) - (plan[0]?.atMs ?? 0)).toBe(24 * 3_600_000);
  });
});
