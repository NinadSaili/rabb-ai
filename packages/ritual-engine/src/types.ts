export const RITUAL_STATUSES = [
  'IDLE',
  'RITUAL_STARTED',
  'SCRIPTURE_COMPLETED',
  'PRAYER_COMPLETED',
  'TIMER_COMPLETED',
  'RITUAL_COMPLETED',
  'UNLOCK_REQUESTED',
  'UNLOCKED',
  'ABANDONED',
  'EXPIRED',
  'UNLOCK_FAILED',
] as const;
export type RitualStatus = (typeof RITUAL_STATUSES)[number];

export const RITUAL_EVENT_TYPES = [
  'START',
  'COMPLETE_SCRIPTURE',
  'COMPLETE_PRAYER',
  'COMPLETE_TIMER',
  'FINISH',
  'REQUEST_UNLOCK',
  'UNLOCK_CONFIRMED',
  'UNLOCK_FAILED',
  'RETRY_UNLOCK',
  'ABANDON',
  'DAY_ROLLED_OVER',
] as const;
export type RitualEventType = (typeof RITUAL_EVENT_TYPES)[number];

export type UnlockFailureReason =
  | 'authorization_revoked'
  | 'entitlement_missing'
  | 'native_error'
  | 'status_mismatch';

export type RitualEvent =
  | { type: 'START'; sessionId: string; scheduleId: string; localDate: string; timerSeconds: number | null }
  | { type: 'COMPLETE_SCRIPTURE' }
  | { type: 'COMPLETE_PRAYER' }
  /** monotonicMs comes from a monotonic device clock, never wall clock time. */
  | { type: 'COMPLETE_TIMER'; monotonicMs: number }
  | { type: 'FINISH' }
  | { type: 'REQUEST_UNLOCK' }
  | { type: 'UNLOCK_CONFIRMED' }
  | { type: 'UNLOCK_FAILED'; reason: UnlockFailureReason }
  | { type: 'RETRY_UNLOCK' }
  | { type: 'ABANDON' }
  /** currentLocalDate is the server computed ritual date at the moment of observation. */
  | { type: 'DAY_ROLLED_OVER'; currentLocalDate: string };

export interface RitualState {
  status: RitualStatus;
  sessionId: string | null;
  scheduleId: string | null;
  /** Bound once at START. Never changes afterwards (timezone travel cannot rebind). */
  localDate: string | null;
  /** null means no timer is configured for this ritual. */
  timerSeconds: number | null;
  failureReason: UnlockFailureReason | null;
}

export type RejectionCode =
  | 'ILLEGAL_TRANSITION'
  | 'DUPLICATE_STEP'
  | 'TIMER_NOT_CONFIGURED'
  | 'TIMER_TOO_SHORT'
  | 'TIMER_REQUIRED'
  | 'INVALID_EVENT_PAYLOAD'
  | 'NOT_ROLLED_OVER';

export interface Rejection {
  code: RejectionCode;
  from: RitualStatus;
  event: RitualEventType;
  message: string;
}

export type TransitionResult =
  | { ok: true; state: RitualState }
  | { ok: false; state: RitualState; rejection: Rejection };
