import { scheduleSchema, toRequestBody } from './form';
import { toCoreSchedule } from './api';

const base = { kind: 'custom' as const, name: 'Evening', startHour: 20, durationHours: 4, weekdays: [1, 2], timerSeconds: 60, unlockUntilMidnight: true };

describe('schedule form', () => {
  it('maps to the API body with minutes and midnight unlock for custom schedules', () => {
    expect(toRequestBody(base, 'k')).toMatchObject({ start_minute: 1200, end_minute: 1440, unlock_until: 'midnight', idempotency_key: 'k', timer_seconds: 60 });
  });
  it('never sends midnight unlock for the morning schedule', () => {
    expect(toRequestBody({ ...base, kind: 'morning' }, 'k').unlock_until).toBe('window_end');
  });
  it('validates ranges', () => {
    expect(scheduleSchema.safeParse({ ...base, startHour: 24 }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...base, timerSeconds: 10 }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...base, weekdays: [] }).success).toBe(false);
  });
  it('converts a server schedule to the schedule-core model', () => {
    const core = toCoreSchedule({ id: '123e4567-e89b-42d3-a456-426614174000', name: 'm', kind: 'morning', enabled: true, weekdays: [1], start_minute: 300, end_minute: 720, timer_seconds: null, unlock_until: 'window_end' });
    expect(core).toEqual({ id: '123e4567-e89b-42d3-a456-426614174000', enabled: true, weekdays: [1], startMinute: 300, endMinute: 720, unlockUntil: 'window_end' });
  });
});
