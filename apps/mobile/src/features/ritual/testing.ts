// Test helpers only. Not imported by app code.
import { Analytics } from '../../services/analytics/analytics';
import type { AppBlockingService, NativeStatus } from '../../services/blocking/types';
import { MutationQueue } from '../../services/queue/mutationQueue';
import { MemoryKeyValueStore } from '../../services/storage/kv';
import { RitualController } from './ritualController';

export class FakeBlocking implements AppBlockingService {
  applied = true;
  stuck = false;
  throws = false;
  tier: 'tier0' | 'tier1' = 'tier1';
  failure: NativeStatus['failure'] = null;
  calls: string[] = [];
  private status(): NativeStatus {
    return { restrictionApplied: this.applied, tier: this.tier, lastHeartbeatMs: null, failure: this.failure };
  }
  private act(name: string): Promise<NativeStatus> {
    this.calls.push(name);
    if (this.throws) return Promise.reject(new Error('native'));
    if (!this.stuck) this.applied = false;
    return Promise.resolve(this.status());
  }
  getCapabilities() { return Promise.resolve({ platform: 'android' as const, tier: this.tier, unmet: [], guaranteed: false as const }); }
  getPermissionState() { return Promise.resolve('granted' as const); }
  requestPermission() { return Promise.resolve('granted' as const); }
  presentAppPicker() { return Promise.resolve({ result: 'cancelled' as const, summary: { count: 0, categoryCount: 0, webDomainCount: 0 } }); }
  getSelectedApplicationDisplayNames() { return Promise.resolve({ count: 2, categoryCount: 0, webDomainCount: 0 }); }
  applyRestrictions() { this.applied = true; return Promise.resolve(this.status()); }
  removeRestrictions() { return this.act('remove'); }
  suspendUntil() { return this.act('suspend'); }
  disableBlocking() { return this.act('disable'); }
  scheduleRestrictions() { return Promise.resolve(); }
  getRestrictionStatus() { this.calls.push('status'); return this.throws ? Promise.reject(new Error('native')) : Promise.resolve(this.status()); }
}

export function makeRitual(over: { suspendUntil?: number | null; localDate?: () => string } = {}) {
  let id = 0;
  let mono = 1000;
  const store = new MemoryKeyValueStore();
  const queue = new MutationQueue(store);
  const blocking = new FakeBlocking();
  const sent: string[] = [];
  const analytics = new Analytics({ capture: (e) => sent.push(e) }, true);
  let syncs = 0;
  const controller = new RitualController({
    queue,
    blocking,
    analytics,
    newId: () => `id-${++id}`,
    monotonicNow: () => mono,
    currentLocalDate: over.localDate ?? (() => '2026-03-10'),
    suspendUntilMs: () => (over.suspendUntil === undefined ? 1_800_000_000_000 : over.suspendUntil),
    triggerSync: () => { syncs++; },
  });
  return { controller, queue, blocking, store, events: sent, advance: (ms: number) => { mono += ms; }, syncs: () => syncs, analytics };
}
