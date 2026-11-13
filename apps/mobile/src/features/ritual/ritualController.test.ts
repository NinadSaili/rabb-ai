import { makeRitual } from './testing';

const START = { scheduleId: 's1', timerSeconds: 60, localDate: '2026-03-10' };

describe('RitualController', () => {
  it('runs the full ritual with a timer and unlocks, verified by the native read back', async () => {
    const t = makeRitual();
    expect(t.controller.start(START)).toBe(true);
    expect(t.controller.completeScripture()).toBe(true);
    expect(t.controller.completePrayer()).toBe(true);
    t.controller.startTimer();
    t.advance(61_000);
    expect(t.controller.completeTimer()).toBe(true);
    expect(t.controller.finish()).toBe(true);
    expect(t.controller.state.status).toBe('RITUAL_COMPLETED');
    const unlock = await t.controller.requestUnlock();
    expect(t.controller.state.status).toBe('UNLOCKED');
    expect(t.blocking.calls).toEqual(['suspend', 'status']);
    // Mutations are still queued: no claim of server sync.
    expect(unlock).toEqual({ kind: 'unlocked_local_sync_pending', pending: 5 });
    await t.queue.flush(async () => ({ status: 'ok' }));
    t.controller.refreshSyncLabel();
    expect(t.controller.unlock).toEqual({ kind: 'unlocked_verified' });
    expect(t.events).toEqual(['ritual_started', 'scripture_completed', 'prayer_completed', 'ritual_completed', 'restriction_removed']);
  });

  it('works without a timer', async () => {
    const t = makeRitual();
    t.controller.start({ ...START, timerSeconds: null });
    t.controller.completeScripture();
    t.controller.completePrayer();
    expect(t.controller.finish()).toBe(true);
    expect(t.queue.peek().map((m) => m.kind)).toEqual(['ritual.start', 'ritual.complete_step', 'ritual.complete_step', 'ritual.complete']);
  });

  it('rejects an early timer and enqueues nothing for it', () => {
    const t = makeRitual();
    t.controller.start(START);
    t.controller.completeScripture();
    t.controller.completePrayer();
    t.controller.startTimer();
    t.advance(10_000);
    const before = t.queue.size();
    expect(t.controller.completeTimer()).toBe(false);
    expect(t.controller.lastRejection).toBe('TIMER_TOO_SHORT');
    expect(t.queue.size()).toBe(before);
    expect(t.controller.finish()).toBe(false);
    expect(t.controller.lastRejection).toBe('TIMER_REQUIRED');
  });

  it('measures the timer on the monotonic clock only and sends monotonic_ms', () => {
    const t = makeRitual();
    t.controller.start(START);
    t.controller.completeScripture();
    t.controller.completePrayer();
    t.controller.startTimer();
    t.advance(60_500);
    t.controller.completeTimer();
    const step = t.queue.peek().find((m) => m.payload.step_type === 'timer');
    expect(step?.payload.monotonic_ms).toBe(60_500);
    expect(JSON.stringify(step?.payload)).not.toMatch(/date|time(?!r)/i);
  });

  it('prevents duplicate completion events and wrong order', () => {
    const t = makeRitual();
    t.controller.start(START);
    expect(t.controller.completePrayer()).toBe(false);
    expect(t.controller.lastRejection).toBe('ILLEGAL_TRANSITION');
    t.controller.completeScripture();
    expect(t.controller.completeScripture()).toBe(false);
    expect(t.controller.lastRejection).toBe('DUPLICATE_STEP');
    expect(t.queue.peek().filter((m) => m.payload.step_type === 'scripture')).toHaveLength(1);
    expect(t.controller.start(START)).toBe(false);
  });

  it('reports unlock failure when the OS still reports the restriction, then retries', async () => {
    const t = makeRitual();
    t.controller.start({ ...START, timerSeconds: null });
    t.controller.completeScripture();
    t.controller.completePrayer();
    t.controller.finish();
    t.blocking.stuck = true;
    const failed = await t.controller.requestUnlock();
    expect(failed).toEqual({ kind: 'unlock_failed', reason: 'still_restricted' });
    expect(t.controller.state.status).toBe('UNLOCK_FAILED');
    t.blocking.stuck = false;
    const retry = await t.controller.requestUnlock();
    expect(retry.kind).toBe('unlocked_local_sync_pending');
    expect(t.controller.state.status).toBe('UNLOCKED');
  });

  it('reports a native exception as unlock failed, never as unlocked', async () => {
    const t = makeRitual();
    t.controller.start({ ...START, timerSeconds: null });
    t.controller.completeScripture();
    t.controller.completePrayer();
    t.controller.finish();
    t.blocking.throws = true;
    expect(await t.controller.requestUnlock()).toEqual({ kind: 'unlock_failed', reason: 'native_error' });
  });

  it('surfaces authorization revoked as the failure reason', async () => {
    const t = makeRitual();
    t.controller.start({ ...START, timerSeconds: null });
    t.controller.completeScripture();
    t.controller.completePrayer();
    t.controller.finish();
    t.blocking.stuck = true;
    t.blocking.failure = 'authorization_revoked';
    expect(await t.controller.requestUnlock()).toEqual({ kind: 'unlock_failed', reason: 'authorization_revoked' });
  });

  it('does not claim OS verification when nothing is enforced (Tier 0)', async () => {
    const t = makeRitual();
    t.blocking.tier = 'tier0';
    t.controller.start({ ...START, timerSeconds: null });
    t.controller.completeScripture();
    t.controller.completePrayer();
    t.controller.finish();
    expect(await t.controller.requestUnlock()).toEqual({ kind: 'not_enforced' });
  });

  it('a failed sync never produces a synced claim', async () => {
    const t = makeRitual();
    t.controller.start({ ...START, timerSeconds: null });
    t.controller.completeScripture();
    t.controller.completePrayer();
    t.controller.finish();
    await t.controller.requestUnlock();
    await t.queue.flush(async () => ({ status: 'retry' }));
    t.controller.refreshSyncLabel();
    expect(t.controller.unlock.kind).toBe('unlocked_local_sync_pending');
  });

  it('removes restrictions directly when no window is active', async () => {
    const t = makeRitual({ suspendUntil: null });
    t.controller.start({ ...START, timerSeconds: null });
    t.controller.completeScripture();
    t.controller.completePrayer();
    t.controller.finish();
    await t.controller.requestUnlock();
    expect(t.blocking.calls[0]).toBe('remove');
  });

  it('expires an unfinished session when the ritual date rolls over, and never a completed one', () => {
    let date = '2026-03-10';
    const t = makeRitual({ localDate: () => date });
    t.controller.start(START);
    t.controller.completeScripture();
    date = '2026-03-11';
    expect(t.controller.checkRollover()).toBe(true);
    expect(t.controller.state.status).toBe('EXPIRED');
    const u = makeRitual({ localDate: () => date });
    u.controller.start({ ...START, timerSeconds: null });
    u.controller.completeScripture();
    u.controller.completePrayer();
    u.controller.finish();
    expect(u.controller.checkRollover()).toBe(false);
    expect(u.controller.state.status).toBe('RITUAL_COMPLETED');
  });

  it('uses a stable idempotency key per action and distinct keys across actions', () => {
    const t = makeRitual();
    t.controller.start({ ...START, timerSeconds: null });
    t.controller.completeScripture();
    const ids = t.queue.peek().map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('triggers sync after every enqueue', () => {
    const t = makeRitual();
    t.controller.start({ ...START, timerSeconds: null });
    t.controller.completeScripture();
    expect(t.syncs()).toBe(2);
  });
});
