export const TIMER_TOLERANCE = 0.05;

export interface TimerValidationInput {
  requiredSeconds: number;
  /** Device monotonic duration claimed by the client. */
  monotonicMs: number;
  /**
   * Server measured time between the received start and received completion of the timer step.
   * null when both requests arrived after an offline period and cannot be compared.
   */
  serverElapsedMs: number | null;
}

export type TimerValidation =
  | { ok: true; verified: boolean }
  | { ok: false; reason: 'monotonic_too_short' | 'server_elapsed_too_short' | 'monotonic_exceeds_server' };

/**
 * Validates a timer step. Device wall clock time is never an input, so changing the device clock has no effect.
 * Online: server elapsed time bounds the claim from both sides with a 5 percent tolerance.
 * Offline reconciliation (serverElapsedMs null): accepted as unverified when the claim meets the minimum.
 */
export function validateTimer(input: TimerValidationInput): TimerValidation {
  const requiredMs = input.requiredSeconds * 1000;
  if (!Number.isFinite(input.monotonicMs) || input.monotonicMs < requiredMs) {
    return { ok: false, reason: 'monotonic_too_short' };
  }
  if (input.serverElapsedMs === null) return { ok: true, verified: false };
  const upper = 1 + TIMER_TOLERANCE;
  if (input.serverElapsedMs * upper < requiredMs) return { ok: false, reason: 'server_elapsed_too_short' };
  if (input.monotonicMs > input.serverElapsedMs * upper) return { ok: false, reason: 'monotonic_exceeds_server' };
  return { ok: true, verified: true };
}
