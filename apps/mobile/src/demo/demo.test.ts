import { habitsSummaryResponse, startResponse, completeStepResponse, completeResponse, dailyRitualResponse, createScheduleResponse } from '@rabb/contracts';
import { ApiError } from '../services/api/client';
import { MemoryKeyValueStore } from '../services/storage/kv';
import { DemoBlockingService } from './demoBlocking';
import { createDemoApi } from './demoApi';
import { DEMO_PRAYERS, DEMO_TRANSLATION, DEMO_VERSES } from './fixtures';

const NOW = Date.UTC(2026, 10, 21, 14, 0, 0);
const sched = { name: 'Morning', kind: 'morning', enabled: true, weekdays: [0, 1, 2, 3, 4, 5, 6], start_minute: 360, end_minute: 720, timer_seconds: 30, unlock_until: 'window_end', idempotency_key: '123e4567-e89b-42d3-a456-426614174001' };
const setup = () => {
  const kv = new MemoryKeyValueStore();
  return { kv, api: createDemoApi(kv, () => 'America/New_York', () => NOW), blocking: new DemoBlockingService(kv, () => NOW) };
};
const id = (n: number) => `123e4567-e89b-42d3-a456-4266141740${String(n).padStart(2, '0')}`;

describe('demo content is clearly labelled', () => {
  it('uses a DEV ONLY, unlicensed, unverified translation label with attribution', () => {
    expect(DEMO_TRANSLATION.license_name).toMatch(/DEV ONLY/);
    expect(DEMO_TRANSLATION.attribution_text).toMatch(/DEMO placeholder/);
    expect(DEMO_VERSES.length).toBeGreaterThanOrEqual(6);
    expect(DEMO_PRAYERS.length).toBeGreaterThanOrEqual(3);
  });
});

describe('demo API follows the real contracts and ordering rules', () => {
  it('serves content before a schedule exists and with a schedule after', async () => {
    const { api } = setup();
    const before = await api.get('/v1/daily/ritual', dailyRitualResponse, { prefetch_days: 7 });
    expect(before.schedule_id).toBeNull();
    expect(before.days).toHaveLength(8);
    const s = await api.post('/v1/schedules', sched, createScheduleResponse);
    const after = await api.get('/v1/daily/ritual', dailyRitualResponse, { prefetch_days: 0 });
    expect(after.schedule_id).toBe(s.id);
    expect(after.timer_seconds).toBe(30);
  });

  it('enforces scripture first, prayer next, timer last, and refuses an early timer', async () => {
    const { api } = setup();
    const s = await api.post('/v1/schedules', sched, createScheduleResponse);
    const start = await api.post('/v1/ritual/start', { schedule_id: s.id, session_id: id(1), idempotency_key: id(2) }, startResponse);
    const step = (type: string, extra: object = {}) => api.post('/v1/ritual/complete-step', { session_id: start.session_id, step_type: type, idempotency_key: id(3), ...extra }, completeStepResponse);
    await expect(step('prayer')).rejects.toMatchObject({ code: 'illegal_transition' });
    await step('scripture');
    await step('prayer');
    await expect(api.post('/v1/ritual/complete', { session_id: start.session_id, idempotency_key: id(4) }, completeResponse)).rejects.toMatchObject({ code: 'illegal_transition' });
    await expect(step('timer', { monotonic_ms: 29_999 })).rejects.toBeInstanceOf(ApiError);
    const t = await step('timer', { monotonic_ms: 30_000 });
    expect(t.timer_verified).toBe(false); // demo mode has no server time: never reported as verified
    const done = await api.post('/v1/ritual/complete', { session_id: start.session_id, idempotency_key: id(4) }, completeResponse);
    expect(done).toMatchObject({ status: 'completed', timer_verified: false, current_streak: 1 });
    const habits = await api.get('/v1/habits/summary', habitsSummaryResponse);
    expect(habits.total_completed).toBe(1);
  });

  it('refuses learning, tutor and billing endpoints in demo mode', async () => {
    const { api } = setup();
    await expect(api.post('/v1/ai/tutor', { message: 'hi' }, dailyRitualResponse)).rejects.toMatchObject({ code: 'premium_required' });
  });
});

describe('simulated blocking never claims to be real', () => {
  it('reports simulated: true and demo capabilities', async () => {
    const { blocking } = setup();
    expect((await blocking.getCapabilities()).demo).toBe(true);
    expect((await blocking.getRestrictionStatus()).simulated).toBe(true);
  });

  it('restricts only when apps are selected and restrictions are active, and unlocks on suspension', async () => {
    const { blocking } = setup();
    expect((await blocking.getRestrictionStatus()).restrictionApplied).toBe(false);
    blocking.setSelected(['social', 'video', 'not-a-demo-app']);
    expect(blocking.selectedIds()).toEqual(['social', 'video']);
    await blocking.scheduleRestrictions();
    expect((await blocking.getRestrictionStatus()).restrictionApplied).toBe(true);
    await blocking.suspendUntil(NOW + 1000);
    expect((await blocking.getRestrictionStatus()).restrictionApplied).toBe(false);
    await blocking.applyRestrictions();
    expect((await blocking.getRestrictionStatus()).restrictionApplied).toBe(true);
  });

  it('the off switch always works', async () => {
    const { blocking } = setup();
    blocking.setSelected(['social']);
    await blocking.applyRestrictions();
    expect((await blocking.disableBlocking()).restrictionApplied).toBe(false);
  });
});
