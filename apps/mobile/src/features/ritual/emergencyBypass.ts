import { getJson, setJson, type KeyValueStore } from '../../services/storage/kv';
import type { Analytics } from '../../services/analytics/analytics';
import type { AppBlockingService, NativeStatus } from '../../services/blocking/types';

export const BYPASS_HOLD_MS = 5000;
const COUNT_KEY = 'rabb.bypass.counts.v1';
const LOG_KEY = 'rabb.bypass.log.v1';

export interface BypassLogEntry {
  at: number;
  /** Reason code only. Never an app identity. */
  reason: 'hold_confirmed';
}

export type BypassResult =
  | { ok: true; status: NativeStatus }
  | { ok: false; reason: 'hold_too_short' | 'not_confirmed' | 'native_error' };

/**
 * Emergency bypass: always available, works with no network, short deliberate friction (hold 5 seconds, then confirm),
 * a local daily count and a local log. The log and counts never leave the device.
 */
export class EmergencyBypass {
  constructor(
    private readonly store: KeyValueStore,
    private readonly blocking: AppBlockingService,
    private readonly analytics: Analytics,
    private readonly today: () => string,
    private readonly now: () => number = Date.now,
  ) {}

  countToday(): number {
    return getJson<Record<string, number>>(this.store, COUNT_KEY, {})[this.today()] ?? 0;
  }

  log(): BypassLogEntry[] {
    return getJson<BypassLogEntry[]>(this.store, LOG_KEY, []);
  }

  /** untilMs: end of the active window, so restrictions return at the next window start. */
  async perform(input: { heldMs: number; confirmed: boolean }, untilMs: number | null): Promise<BypassResult> {
    if (input.heldMs < BYPASS_HOLD_MS) return { ok: false, reason: 'hold_too_short' };
    if (!input.confirmed) return { ok: false, reason: 'not_confirmed' };
    let status: NativeStatus;
    try {
      if (untilMs !== null) await this.blocking.suspendUntil(untilMs);
      else await this.blocking.removeRestrictions();
      status = await this.blocking.getRestrictionStatus();
    } catch {
      return { ok: false, reason: 'native_error' };
    }
    const counts = getJson<Record<string, number>>(this.store, COUNT_KEY, {});
    const day = this.today();
    setJson(this.store, COUNT_KEY, { ...counts, [day]: (counts[day] ?? 0) + 1 });
    setJson(this.store, LOG_KEY, [...this.log(), { at: this.now(), reason: 'hold_confirmed' }].slice(-100));
    this.analytics.track('emergency_bypass_used');
    this.analytics.track('restriction_removed', { reason: 'emergency_bypass' });
    return { ok: true, status };
  }
}
