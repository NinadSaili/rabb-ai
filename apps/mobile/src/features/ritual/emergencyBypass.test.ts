import { Analytics } from '../../services/analytics/analytics';
import { MemoryKeyValueStore } from '../../services/storage/kv';
import { BYPASS_HOLD_MS, EmergencyBypass } from './emergencyBypass';
import { FakeBlocking } from './testing';

function setup() {
  const store = new MemoryKeyValueStore();
  const blocking = new FakeBlocking();
  const events: { e: string; p: unknown }[] = [];
  const analytics = new Analytics({ capture: (e, p) => events.push({ e, p }) }, true);
  const bypass = new EmergencyBypass(store, blocking, analytics, () => '2026-03-10', () => 1234);
  return { store, blocking, events, bypass };
}

describe('EmergencyBypass', () => {
  it('needs a 5 second hold and a confirmation', async () => {
    const s = setup();
    expect(BYPASS_HOLD_MS).toBe(5000);
    expect(await s.bypass.perform({ heldMs: 4999, confirmed: true }, null)).toEqual({ ok: false, reason: 'hold_too_short' });
    expect(await s.bypass.perform({ heldMs: 5000, confirmed: false }, null)).toEqual({ ok: false, reason: 'not_confirmed' });
    expect(s.blocking.calls).toEqual([]);
    expect(s.bypass.countToday()).toBe(0);
  });

  it('removes restrictions immediately, counts, logs locally and emits events without app identity', async () => {
    const s = setup();
    const r = await s.bypass.perform({ heldMs: 5000, confirmed: true }, 1_800_000_000_000);
    expect(r.ok).toBe(true);
    expect(s.blocking.applied).toBe(false);
    expect(s.blocking.calls).toEqual(['suspend', 'status']);
    expect(s.bypass.countToday()).toBe(1);
    expect(s.bypass.log()).toEqual([{ at: 1234, reason: 'hold_confirmed' }]);
    expect(s.events).toEqual([{ e: 'emergency_bypass_used', p: {} }, { e: 'restriction_removed', p: { reason: 'emergency_bypass' } }]);
    await s.bypass.perform({ heldMs: 6000, confirmed: true }, null);
    expect(s.bypass.countToday()).toBe(2);
  });

  it('works with no network: nothing in the path touches fetch', async () => {
    const original = global.fetch;
    global.fetch = (() => { throw new Error('network used'); }) as never;
    try {
      expect((await setup().bypass.perform({ heldMs: 5000, confirmed: true }, null)).ok).toBe(true);
    } finally {
      global.fetch = original;
    }
  });

  it('does not count a bypass that failed natively', async () => {
    const s = setup();
    s.blocking.throws = true;
    expect(await s.bypass.perform({ heldMs: 5000, confirmed: true }, null)).toEqual({ ok: false, reason: 'native_error' });
    expect(s.bypass.countToday()).toBe(0);
  });
});
