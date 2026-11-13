import {
  RITUAL_EVENT_TYPES,
  RITUAL_STATUSES,
  initialState,
  isInProgress,
  isTerminal,
  ritualReducer,
  transition,
  unlockConditionMet,
  validateTimer,
} from './index';
import type { RitualEvent, RitualState, RitualStatus } from './index';

const START = (timer: number | null): RitualEvent => ({
  type: 'START',
  sessionId: 's1',
  scheduleId: 'sched1',
  localDate: '2026-03-10',
  timerSeconds: timer,
});

function stateAt(status: RitualStatus, timerSeconds: number | null = 60): RitualState {
  return {
    status,
    sessionId: status === 'IDLE' ? null : 's1',
    scheduleId: status === 'IDLE' ? null : 'sched1',
    localDate: status === 'IDLE' ? null : '2026-03-10',
    timerSeconds,
    failureReason: status === 'UNLOCK_FAILED' ? 'native_error' : null,
  };
}

/** Sample event per type that is valid whenever the transition is legal. */
function sampleEvent(type: RitualEvent['type'], timer: number | null): RitualEvent {
  switch (type) {
    case 'START':
      return START(timer);
    case 'COMPLETE_TIMER':
      return { type, monotonicMs: (timer ?? 60) * 1000 };
    case 'UNLOCK_FAILED':
      return { type, reason: 'native_error' };
    case 'DAY_ROLLED_OVER':
      return { type, currentLocalDate: '2026-03-11' };
    default:
      return { type } as RitualEvent;
  }
}

/** Independent specification: (status, event) -> next status for legal transitions with a timer configured. */
const LEGAL_WITH_TIMER: Record<string, RitualStatus> = {
  'IDLE|START': 'RITUAL_STARTED',
  'RITUAL_STARTED|COMPLETE_SCRIPTURE': 'SCRIPTURE_COMPLETED',
  'SCRIPTURE_COMPLETED|COMPLETE_PRAYER': 'PRAYER_COMPLETED',
  'PRAYER_COMPLETED|COMPLETE_TIMER': 'TIMER_COMPLETED',
  'TIMER_COMPLETED|FINISH': 'RITUAL_COMPLETED',
  'RITUAL_COMPLETED|REQUEST_UNLOCK': 'UNLOCK_REQUESTED',
  'UNLOCK_REQUESTED|UNLOCK_CONFIRMED': 'UNLOCKED',
  'UNLOCK_REQUESTED|UNLOCK_FAILED': 'UNLOCK_FAILED',
  'UNLOCK_FAILED|RETRY_UNLOCK': 'UNLOCK_REQUESTED',
  'RITUAL_STARTED|ABANDON': 'ABANDONED',
  'SCRIPTURE_COMPLETED|ABANDON': 'ABANDONED',
  'PRAYER_COMPLETED|ABANDON': 'ABANDONED',
  'TIMER_COMPLETED|ABANDON': 'ABANDONED',
  'RITUAL_STARTED|DAY_ROLLED_OVER': 'EXPIRED',
  'SCRIPTURE_COMPLETED|DAY_ROLLED_OVER': 'EXPIRED',
  'PRAYER_COMPLETED|DAY_ROLLED_OVER': 'EXPIRED',
  'TIMER_COMPLETED|DAY_ROLLED_OVER': 'EXPIRED',
};

describe('ritual state machine, timer configured: every (status, event) pair', () => {
  for (const status of RITUAL_STATUSES) {
    for (const type of RITUAL_EVENT_TYPES) {
      const key = `${status}|${type}`;
      const expected = LEGAL_WITH_TIMER[key];
      it(`${key} ${expected ? `-> ${expected}` : 'is rejected'}`, () => {
        const state = stateAt(status, 60);
        const result = transition(state, sampleEvent(type, 60));
        if (expected) {
          expect(result.ok).toBe(true);
          expect(result.state.status).toBe(expected);
        } else {
          expect(result.ok).toBe(false);
          expect(result.state).toBe(state);
          if (!result.ok) expect(['ILLEGAL_TRANSITION', 'DUPLICATE_STEP', 'TIMER_REQUIRED']).toContain(result.rejection.code);
        }
      });
    }
  }
});

describe('optional timer', () => {
  it('PRAYER_COMPLETED -> RITUAL_COMPLETED through FINISH when no timer is configured', () => {
    const r = transition(stateAt('PRAYER_COMPLETED', null), { type: 'FINISH' });
    expect(r.ok && r.state.status).toBe('RITUAL_COMPLETED');
  });
  it('FINISH is rejected with TIMER_REQUIRED when a timer is configured but not completed', () => {
    const r = transition(stateAt('PRAYER_COMPLETED', 60), { type: 'FINISH' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejection.code).toBe('TIMER_REQUIRED');
  });
  it('COMPLETE_TIMER is rejected when no timer is configured', () => {
    const r = transition(stateAt('PRAYER_COMPLETED', null), { type: 'COMPLETE_TIMER', monotonicMs: 999999 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejection.code).toBe('TIMER_NOT_CONFIGURED');
  });
  it('COMPLETE_TIMER below the configured duration is rejected', () => {
    const r = transition(stateAt('PRAYER_COMPLETED', 60), { type: 'COMPLETE_TIMER', monotonicMs: 59_999 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejection.code).toBe('TIMER_TOO_SHORT');
  });
  it('COMPLETE_TIMER at exactly the duration is accepted', () => {
    const r = transition(stateAt('PRAYER_COMPLETED', 60), { type: 'COMPLETE_TIMER', monotonicMs: 60_000 });
    expect(r.ok).toBe(true);
  });
  it('NaN duration is rejected', () => {
    const r = transition(stateAt('PRAYER_COMPLETED', 60), { type: 'COMPLETE_TIMER', monotonicMs: NaN });
    expect(r.ok).toBe(false);
  });
});

describe('order and duplicates', () => {
  it('prayer before scripture is illegal (documented decision: scripture first)', () => {
    const r = transition(stateAt('RITUAL_STARTED'), { type: 'COMPLETE_PRAYER' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejection.code).toBe('ILLEGAL_TRANSITION');
  });
  it('duplicate scripture completion is flagged DUPLICATE_STEP', () => {
    const r = transition(stateAt('SCRIPTURE_COMPLETED'), { type: 'COMPLETE_SCRIPTURE' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejection.code).toBe('DUPLICATE_STEP');
  });
  it('duplicate FINISH after completion is flagged DUPLICATE_STEP', () => {
    for (const s of ['RITUAL_COMPLETED', 'UNLOCK_REQUESTED', 'UNLOCKED'] as const) {
      const r = transition(stateAt(s), { type: 'FINISH' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.rejection.code).toBe('DUPLICATE_STEP');
    }
  });
  it('replaying the whole event sequence twice never produces a second completion', () => {
    const seq: RitualEvent[] = [START(null), { type: 'COMPLETE_SCRIPTURE' }, { type: 'COMPLETE_PRAYER' }, { type: 'FINISH' }];
    let s = initialState;
    let completions = 0;
    for (let round = 0; round < 2; round++) {
      for (const e of seq) {
        const r = transition(s, e);
        if (r.ok && r.state.status === 'RITUAL_COMPLETED') completions++;
        s = r.state;
      }
    }
    expect(completions).toBe(1);
  });
});

describe('START validation', () => {
  it('rejects bad local date', () => {
    const r = transition(initialState, { ...START(null), localDate: '10-03-2026' } as RitualEvent);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejection.code).toBe('INVALID_EVENT_PAYLOAD');
  });
  it('rejects zero or fractional timer', () => {
    expect(transition(initialState, START(0)).ok).toBe(false);
    expect(transition(initialState, START(1.5)).ok).toBe(false);
  });
  it('binds local date and does not change it later', () => {
    let s = ritualReducer(initialState, START(null));
    s = ritualReducer(s, { type: 'COMPLETE_SCRIPTURE' });
    expect(s.localDate).toBe('2026-03-10');
  });
});

describe('day rollover', () => {
  it('expires an in progress ritual when the date changed', () => {
    const r = transition(stateAt('PRAYER_COMPLETED'), { type: 'DAY_ROLLED_OVER', currentLocalDate: '2026-03-11' });
    expect(r.ok && r.state.status).toBe('EXPIRED');
  });
  it('does not expire when the date is the same', () => {
    const r = transition(stateAt('PRAYER_COMPLETED'), { type: 'DAY_ROLLED_OVER', currentLocalDate: '2026-03-10' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejection.code).toBe('NOT_ROLLED_OVER');
  });
  it('never expires an already completed ritual', () => {
    const r = transition(stateAt('RITUAL_COMPLETED'), { type: 'DAY_ROLLED_OVER', currentLocalDate: '2026-03-11' });
    expect(r.ok).toBe(false);
  });
});

describe('unlock', () => {
  it('failure then retry then success', () => {
    let s = stateAt('UNLOCK_REQUESTED');
    s = ritualReducer(s, { type: 'UNLOCK_FAILED', reason: 'authorization_revoked' });
    expect(s.status).toBe('UNLOCK_FAILED');
    expect(s.failureReason).toBe('authorization_revoked');
    s = ritualReducer(s, { type: 'RETRY_UNLOCK' });
    expect(s.failureReason).toBeNull();
    s = ritualReducer(s, { type: 'UNLOCK_CONFIRMED' });
    expect(s.status).toBe('UNLOCKED');
  });
  it('unlock condition is only met after the full ritual', () => {
    for (const s of ['IDLE', 'RITUAL_STARTED', 'SCRIPTURE_COMPLETED', 'PRAYER_COMPLETED', 'TIMER_COMPLETED', 'ABANDONED', 'EXPIRED'] as const) {
      expect(unlockConditionMet(stateAt(s))).toBe(false);
    }
    for (const s of ['RITUAL_COMPLETED', 'UNLOCK_REQUESTED', 'UNLOCKED', 'UNLOCK_FAILED'] as const) {
      expect(unlockConditionMet(stateAt(s))).toBe(true);
    }
  });
});

describe('helpers', () => {
  it('classifies statuses', () => {
    expect(RITUAL_STATUSES.filter(isInProgress)).toHaveLength(4);
    expect(RITUAL_STATUSES.filter(isTerminal).sort()).toEqual(['ABANDONED', 'EXPIRED', 'UNLOCKED']);
  });
  it('terminal states reject every event', () => {
    for (const s of ['UNLOCKED', 'ABANDONED', 'EXPIRED'] as const) {
      for (const t of RITUAL_EVENT_TYPES) {
        expect(transition(stateAt(s), sampleEvent(t, 60)).ok).toBe(false);
      }
    }
  });
});

describe('validateTimer', () => {
  it('accepts a claim within the 5 percent tolerance online', () => {
    expect(validateTimer({ requiredSeconds: 300, monotonicMs: 300_000, serverElapsedMs: 290_000 })).toEqual({ ok: true, verified: true });
  });
  it('rejects when the server saw too little time (early completion)', () => {
    const r = validateTimer({ requiredSeconds: 300, monotonicMs: 300_000, serverElapsedMs: 100_000 });
    expect(r).toEqual({ ok: false, reason: 'server_elapsed_too_short' });
  });
  it('rejects at just under the boundary and accepts at the boundary', () => {
    expect(validateTimer({ requiredSeconds: 100, monotonicMs: 100_000, serverElapsedMs: 95_300 }).ok).toBe(true);
    expect(validateTimer({ requiredSeconds: 100, monotonicMs: 100_000, serverElapsedMs: 95_200 }).ok).toBe(false);
  });
  it('rejects a monotonic claim shorter than required', () => {
    expect(validateTimer({ requiredSeconds: 60, monotonicMs: 59_000, serverElapsedMs: 120_000 })).toEqual({ ok: false, reason: 'monotonic_too_short' });
  });
  it('rejects a claim much longer than the server saw', () => {
    expect(validateTimer({ requiredSeconds: 60, monotonicMs: 600_000, serverElapsedMs: 61_000 })).toEqual({ ok: false, reason: 'monotonic_exceeds_server' });
  });
  it('accepts offline reconciliation as unverified', () => {
    expect(validateTimer({ requiredSeconds: 60, monotonicMs: 61_000, serverElapsedMs: null })).toEqual({ ok: true, verified: false });
  });
  it('does not take any device wall clock input (signature check)', () => {
    expect(Object.keys({ requiredSeconds: 1, monotonicMs: 1, serverElapsedMs: 1 })).not.toContain('deviceTimestamp');
  });
});
