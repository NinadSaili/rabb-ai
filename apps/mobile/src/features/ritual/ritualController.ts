import { initialState, transition, type RitualEvent, type RitualState } from '@rabb/ritual-engine';
import type { Analytics } from '../../services/analytics/analytics';
import type { AppBlockingService, NativeFailure } from '../../services/blocking/types';
import type { FlushReport, MutationQueue } from '../../services/queue/mutationQueue';

export type UnlockStatus =
  | { kind: 'none' }
  /** The OS layer reports no restriction and nothing is waiting to sync. */
  | { kind: 'unlocked_verified' }
  /** The OS layer reports no restriction, but ritual mutations have not reached the server yet. */
  | { kind: 'unlocked_local_sync_pending'; pending: number }
  | { kind: 'unlock_failed'; reason: NativeFailure | 'still_restricted' }
  /** The OS layer is unlocked, but the server permanently rejected part of this ritual, so it is not recorded and may not count for the streak. */
  | { kind: 'unlocked_local_not_recorded'; code: string }
  /** DEMO MODE: the restriction was simulated, so there is no OS verification to claim. */
  | { kind: 'unlocked_simulated' }
  /** Tier 0 or native module missing: nothing was restricted, so there is nothing to verify. */
  | { kind: 'not_enforced' };

export interface RitualDeps {
  queue: MutationQueue;
  blocking: AppBlockingService;
  analytics: Analytics;
  newId: () => string;
  /** Monotonic milliseconds (performance.now on device). Never wall clock. */
  monotonicNow: () => number;
  /** Local estimate of the ritual date, used only to expire an unfinished session in the UI. The server decides local_date. */
  currentLocalDate: () => string;
  /** End of the post ritual suspension (from schedule-core), or null when no window is active. */
  suspendUntilMs: () => number | null;
  /** Called after enqueueing so the app can try to sync. Errors are swallowed: sync is best effort. */
  triggerSync: () => void;
}

type Listener = (c: RitualController) => void;

export class RitualController {
  state: RitualState = initialState;
  unlock: UnlockStatus = { kind: 'none' };
  /** Rejection from the last event, for the UI to explain. */
  lastRejection: string | null = null;
  /** Set when the server permanently rejected a mutation of this ritual. */
  syncRejection: string | null = null;
  private timerStartedAt: number | null = null;
  private listeners = new Set<Listener>();

  constructor(private readonly deps: RitualDeps) {}

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  private emit(): void {
    this.listeners.forEach((l) => l(this));
  }

  private dispatch(event: RitualEvent): boolean {
    const r = transition(this.state, event);
    this.state = r.state;
    this.lastRejection = r.ok ? null : r.rejection.code;
    this.emit();
    return r.ok;
  }

  start(input: { scheduleId: string; timerSeconds: number | null; localDate: string }): boolean {
    const sessionId = this.deps.newId();
    const ok = this.dispatch({ type: 'START', sessionId, scheduleId: input.scheduleId, localDate: input.localDate, timerSeconds: input.timerSeconds });
    if (!ok) return false;
    this.deps.queue.enqueue('ritual.start', { schedule_id: input.scheduleId, session_id: sessionId }, this.deps.newId());
    this.deps.analytics.track('ritual_started', { timer_enabled: input.timerSeconds !== null });
    this.deps.triggerSync();
    return true;
  }

  private enqueueStep(step: 'scripture' | 'prayer' | 'timer', extra: Record<string, unknown> = {}): void {
    this.deps.queue.enqueue('ritual.complete_step', { session_id: this.state.sessionId, step_type: step, ...extra }, this.deps.newId());
    this.deps.triggerSync();
  }

  completeScripture(): boolean {
    if (!this.dispatch({ type: 'COMPLETE_SCRIPTURE' })) return false;
    this.enqueueStep('scripture');
    this.deps.analytics.track('scripture_completed');
    return true;
  }

  completePrayer(): boolean {
    if (!this.dispatch({ type: 'COMPLETE_PRAYER' })) return false;
    this.enqueueStep('prayer');
    this.deps.analytics.track('prayer_completed');
    return true;
  }

  /** Starts the reading timer on the monotonic clock. Safe to call again: the first start wins. */
  startTimer(): void {
    if (this.timerStartedAt === null) this.timerStartedAt = this.deps.monotonicNow();
  }

  elapsedTimerMs(): number {
    return this.timerStartedAt === null ? 0 : Math.max(0, this.deps.monotonicNow() - this.timerStartedAt);
  }

  completeTimer(): boolean {
    const monotonicMs = Math.floor(this.elapsedTimerMs());
    if (!this.dispatch({ type: 'COMPLETE_TIMER', monotonicMs })) return false;
    this.enqueueStep('timer', { monotonic_ms: monotonicMs });
    return true;
  }

  finish(): boolean {
    const timerEnabled = this.state.timerSeconds !== null;
    if (!this.dispatch({ type: 'FINISH' })) return false;
    this.deps.queue.enqueue('ritual.complete', { session_id: this.state.sessionId }, this.deps.newId());
    this.deps.analytics.track('ritual_completed', { step_count: timerEnabled ? 3 : 2, timer_enabled: timerEnabled, offline: this.deps.queue.size() > 0 });
    this.deps.triggerSync();
    return true;
  }

  abandon(): boolean {
    return this.dispatch({ type: 'ABANDON' });
  }

  /** Call when the app foregrounds or a minute passes. Expires an unfinished session after the date rolled over. */
  checkRollover(): boolean {
    const today = this.deps.currentLocalDate();
    if (this.state.localDate === null || today === this.state.localDate) return false;
    return this.dispatch({ type: 'DAY_ROLLED_OVER', currentLocalDate: today });
  }

  /** Unlock is a local OS action. It never waits for the network and never claims server sync. */
  async requestUnlock(): Promise<UnlockStatus> {
    if (this.state.status === 'UNLOCK_FAILED') {
      if (!this.dispatch({ type: 'RETRY_UNLOCK' })) return this.unlock;
    } else if (!this.dispatch({ type: 'REQUEST_UNLOCK' })) {
      return this.unlock;
    }
    return await this.performUnlock();
  }

  private async performUnlock(): Promise<UnlockStatus> {
    const { blocking } = this.deps;
    let status;
    try {
      const until = this.deps.suspendUntilMs();
      if (until !== null) await blocking.suspendUntil(until);
      else await blocking.removeRestrictions();
      status = await blocking.getRestrictionStatus(); // always read back from the native layer
    } catch {
      return this.failUnlock('native_error');
    }
    if (status.failure === 'native_module_unavailable' || status.tier === 'tier0') {
      this.dispatch({ type: 'UNLOCK_CONFIRMED' });
      this.unlock = { kind: 'not_enforced' };
      this.emit();
      return this.unlock;
    }
    if (status.restrictionApplied) return this.failUnlock(status.failure ?? 'still_restricted');
    this.dispatch({ type: 'UNLOCK_CONFIRMED' });
    if (status.simulated) {
      this.unlock = { kind: 'unlocked_simulated' };
      this.deps.analytics.track('restriction_removed', { reason: 'ritual_completed' });
      this.emit();
      return this.unlock;
    }
    const pending = this.deps.queue.size();
    this.unlock = pending > 0 ? { kind: 'unlocked_local_sync_pending', pending } : { kind: 'unlocked_verified' };
    this.deps.analytics.track('restriction_removed', { reason: 'ritual_completed' });
    this.emit();
    return this.unlock;
  }

  private failUnlock(reason: NativeFailure | 'still_restricted'): UnlockStatus {
    this.dispatch({ type: 'UNLOCK_FAILED', reason: reason === 'still_restricted' ? 'status_mismatch' : reason === 'authorization_revoked' || reason === 'entitlement_missing' ? reason : 'native_error' });
    this.unlock = { kind: 'unlock_failed', reason };
    this.emit();
    return this.unlock;
  }

  /**
   * Call with the report of every queue flush. A permanent rejection of a ritual mutation (for example a timer the server judged
   * too short) means the ritual was not recorded. The unlock already happened locally, so the UI must say so instead of
   * pretending everything synced.
   */
  noteFlush(report: FlushReport): void {
    if (report.dropped.length === 0 || this.state.sessionId === null) return;
    const code = report.dropped[0]?.code ?? 'rejected';
    if (this.unlock.kind === 'unlocked_verified' || this.unlock.kind === 'unlocked_local_sync_pending') {
      this.unlock = { kind: 'unlocked_local_not_recorded', code };
    }
    this.syncRejection = code;
    this.emit();
  }

  /** Recomputes the sync pending label after a flush. A network failure never turns into a "synced" claim. */
  refreshSyncLabel(): void {
    if (this.unlock.kind === 'unlocked_local_sync_pending' && this.deps.queue.size() === 0) this.unlock = { kind: 'unlocked_verified' };
    else if (this.unlock.kind === 'unlocked_verified' && this.deps.queue.size() > 0) this.unlock = { kind: 'unlocked_local_sync_pending', pending: this.deps.queue.size() };
    this.emit();
  }

  reset(): void {
    this.state = initialState;
    this.unlock = { kind: 'none' };
    this.timerStartedAt = null;
    this.lastRejection = null;
    this.syncRejection = null;
    this.emit();
  }
}
