import type { AppBlockingService, Capabilities, NativeStatus, PermissionKind, PermissionState } from '../services/blocking/types';
import { getJson, setJson, type KeyValueStore } from '../services/storage/kv';
import { DEMO_APPS } from './fixtures';

const KEY = 'demo.blocking.v1';

interface DemoState {
  selected: string[];
  suspendedUntil: number;
  active: boolean;
  granted: PermissionKind[];
}

/**
 * DEMO MODE ONLY. SIMULATES the restriction flow so it can be shown without a device build of the native module.
 * It never touches the OS and never restricts anything. Every status it returns carries simulated: true, and the UI
 * says "simulated" wherever it would otherwise say "restricted" or "verified by your device".
 */
export class DemoBlockingService implements AppBlockingService {
  constructor(private readonly kv: KeyValueStore, private readonly now: () => number = Date.now) {}

  private read(): DemoState {
    return getJson<DemoState>(this.kv, KEY, { selected: [], suspendedUntil: 0, active: false, granted: [] });
  }
  private write(patch: Partial<DemoState>): DemoState {
    const next = { ...this.read(), ...patch };
    setJson(this.kv, KEY, next);
    return next;
  }
  private status(): NativeStatus {
    const s = this.read();
    return { restrictionApplied: s.active && s.selected.length > 0 && this.now() >= s.suspendedUntil, tier: 'tier1', lastHeartbeatMs: this.now(), failure: null, simulated: true };
  }

  demoApps() {
    return DEMO_APPS;
  }
  selectedIds(): string[] {
    return this.read().selected;
  }
  setSelected(ids: string[]): void {
    this.write({ selected: ids.filter((id) => DEMO_APPS.some((a) => a.id === id)) });
  }

  getCapabilities(): Promise<Capabilities> {
    return Promise.resolve({
      platform: 'android',
      tier: 'tier1',
      guaranteed: false,
      demo: true,
      unmet: [{ requirement: 'flag', message: 'DEMO MODE: restrictions are simulated. Nothing is enforced on this device.' }],
    });
  }
  getPermissionState(kind: PermissionKind): Promise<PermissionState> {
    return Promise.resolve(this.read().granted.includes(kind) ? 'granted' : 'denied');
  }
  requestPermission(kind: PermissionKind): Promise<PermissionState> {
    const s = this.read();
    this.write({ granted: Array.from(new Set([...s.granted, kind])) });
    return Promise.resolve('granted');
  }
  presentAppPicker() {
    const n = this.read().selected.length;
    return Promise.resolve({ result: 'selected' as const, summary: { count: n, categoryCount: 0, webDomainCount: 0 } });
  }
  getSelectedApplicationDisplayNames() {
    const names = this.read().selected.map((id) => DEMO_APPS.find((a) => a.id === id)?.label ?? id);
    return Promise.resolve({ count: names.length, categoryCount: 0, webDomainCount: 0, names });
  }
  applyRestrictions() {
    this.write({ active: true, suspendedUntil: 0 });
    return Promise.resolve(this.status());
  }
  removeRestrictions() {
    // Demo day: stay unlocked for the rest of the demo. "Reset demo" restores the restriction.
    this.write({ suspendedUntil: this.now() + 12 * 3_600_000 });
    return Promise.resolve(this.status());
  }
  suspendUntil(untilMs: number) {
    this.write({ suspendedUntil: untilMs });
    return Promise.resolve(this.status());
  }
  disableBlocking() {
    this.write({ active: false, suspendedUntil: this.now() });
    return Promise.resolve(this.status());
  }
  scheduleRestrictions() {
    // Windows are ignored in demo mode so the restriction can be shown at any time of day.
    this.write({ active: true });
    return Promise.resolve();
  }
  getRestrictionStatus() {
    return Promise.resolve(this.status());
  }
}
