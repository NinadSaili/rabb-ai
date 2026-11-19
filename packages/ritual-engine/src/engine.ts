import type { Rejection, RejectionCode, RitualEvent, RitualState, RitualStatus, TransitionResult } from './types.ts';

export const initialState: RitualState = Object.freeze({
  status: 'IDLE',
  sessionId: null,
  scheduleId: null,
  localDate: null,
  timerSeconds: null,
  failureReason: null,
});

/** In progress states: the ritual is underway and has not produced a completion. */
const IN_PROGRESS: readonly RitualStatus[] = ['RITUAL_STARTED', 'SCRIPTURE_COMPLETED', 'PRAYER_COMPLETED', 'TIMER_COMPLETED'];

export function isInProgress(status: RitualStatus): boolean {
  return IN_PROGRESS.includes(status);
}

export function isTerminal(status: RitualStatus): boolean {
  return status === 'UNLOCKED' || status === 'ABANDONED' || status === 'EXPIRED';
}

function reject(state: RitualState, event: RitualEvent, code: RejectionCode, message: string): TransitionResult {
  const rejection: Rejection = { code, from: state.status, event: event.type, message };
  return { ok: false, state, rejection };
}

function advance(state: RitualState, patch: Partial<RitualState>): TransitionResult {
  return { ok: true, state: { ...state, ...patch } };
}

/** The step a duplicate event refers to, when the state already passed it. */
function alreadyPassed(status: RitualStatus, event: RitualEvent['type']): boolean {
  const order: RitualStatus[] = ['RITUAL_STARTED', 'SCRIPTURE_COMPLETED', 'PRAYER_COMPLETED', 'TIMER_COMPLETED', 'RITUAL_COMPLETED', 'UNLOCK_REQUESTED', 'UNLOCKED', 'UNLOCK_FAILED'];
  const idx = order.indexOf(status);
  const needs: Partial<Record<RitualEvent['type'], RitualStatus>> = {
    COMPLETE_SCRIPTURE: 'SCRIPTURE_COMPLETED',
    COMPLETE_PRAYER: 'PRAYER_COMPLETED',
    COMPLETE_TIMER: 'TIMER_COMPLETED',
    FINISH: 'RITUAL_COMPLETED',
  };
  const target = needs[event];
  if (!target || idx < 0) return false;
  return idx >= order.indexOf(target);
}

function illegal(state: RitualState, event: RitualEvent): TransitionResult {
  if (alreadyPassed(state.status, event.type)) {
    return reject(state, event, 'DUPLICATE_STEP', `${event.type} was already applied (state ${state.status})`);
  }
  return reject(state, event, 'ILLEGAL_TRANSITION', `${event.type} is not allowed in state ${state.status}`);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pure transition function. Illegal transitions return ok:false with the unchanged state.
 * Order decision: scripture first, then prayer. Prayer before scripture is illegal.
 */
export function transition(state: RitualState, event: RitualEvent): TransitionResult {
  switch (event.type) {
    case 'START': {
      if (state.status !== 'IDLE') return illegal(state, event);
      if (!ISO_DATE.test(event.localDate) || event.sessionId === '' || event.scheduleId === '') {
        return reject(state, event, 'INVALID_EVENT_PAYLOAD', 'START needs sessionId, scheduleId and localDate (YYYY-MM-DD)');
      }
      if (event.timerSeconds !== null && (!Number.isInteger(event.timerSeconds) || event.timerSeconds <= 0)) {
        return reject(state, event, 'INVALID_EVENT_PAYLOAD', 'timerSeconds must be a positive integer or null');
      }
      return advance(state, {
        status: 'RITUAL_STARTED',
        sessionId: event.sessionId,
        scheduleId: event.scheduleId,
        localDate: event.localDate,
        timerSeconds: event.timerSeconds,
        failureReason: null,
      });
    }
    case 'COMPLETE_SCRIPTURE':
      if (state.status !== 'RITUAL_STARTED') return illegal(state, event);
      return advance(state, { status: 'SCRIPTURE_COMPLETED' });
    case 'COMPLETE_PRAYER':
      if (state.status !== 'SCRIPTURE_COMPLETED') return illegal(state, event);
      return advance(state, { status: 'PRAYER_COMPLETED' });
    case 'COMPLETE_TIMER': {
      if (state.status !== 'PRAYER_COMPLETED') return illegal(state, event);
      if (state.timerSeconds === null) {
        return reject(state, event, 'TIMER_NOT_CONFIGURED', 'No timer is configured for this ritual');
      }
      if (!Number.isFinite(event.monotonicMs) || event.monotonicMs < state.timerSeconds * 1000) {
        return reject(state, event, 'TIMER_TOO_SHORT', 'Monotonic duration is shorter than the configured timer');
      }
      return advance(state, { status: 'TIMER_COMPLETED' });
    }
    case 'FINISH': {
      if (state.status === 'PRAYER_COMPLETED') {
        if (state.timerSeconds !== null) {
          return reject(state, event, 'TIMER_REQUIRED', 'A timer is configured and has not been completed');
        }
        return advance(state, { status: 'RITUAL_COMPLETED' });
      }
      if (state.status === 'TIMER_COMPLETED') return advance(state, { status: 'RITUAL_COMPLETED' });
      return illegal(state, event);
    }
    case 'REQUEST_UNLOCK':
      if (state.status !== 'RITUAL_COMPLETED') return illegal(state, event);
      return advance(state, { status: 'UNLOCK_REQUESTED' });
    case 'UNLOCK_CONFIRMED':
      if (state.status !== 'UNLOCK_REQUESTED') return illegal(state, event);
      return advance(state, { status: 'UNLOCKED', failureReason: null });
    case 'UNLOCK_FAILED':
      if (state.status !== 'UNLOCK_REQUESTED') return illegal(state, event);
      return advance(state, { status: 'UNLOCK_FAILED', failureReason: event.reason });
    case 'RETRY_UNLOCK':
      if (state.status !== 'UNLOCK_FAILED') return illegal(state, event);
      return advance(state, { status: 'UNLOCK_REQUESTED', failureReason: null });
    case 'ABANDON':
      if (!isInProgress(state.status)) return illegal(state, event);
      return advance(state, { status: 'ABANDONED' });
    case 'DAY_ROLLED_OVER': {
      if (!isInProgress(state.status)) return illegal(state, event);
      if (!ISO_DATE.test(event.currentLocalDate)) {
        return reject(state, event, 'INVALID_EVENT_PAYLOAD', 'currentLocalDate must be YYYY-MM-DD');
      }
      if (event.currentLocalDate === state.localDate) {
        return reject(state, event, 'NOT_ROLLED_OVER', 'currentLocalDate equals the session local date');
      }
      return advance(state, { status: 'EXPIRED' });
    }
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

/** Reducer form for stores. Rejected events leave state untouched. */
export function ritualReducer(state: RitualState, event: RitualEvent): RitualState {
  return transition(state, event).state;
}

/** True once scripture, prayer and (when configured) the timer are done. */
export function unlockConditionMet(state: RitualState): boolean {
  return state.status === 'RITUAL_COMPLETED' || state.status === 'UNLOCK_REQUESTED' || state.status === 'UNLOCKED' || state.status === 'UNLOCK_FAILED';
}
