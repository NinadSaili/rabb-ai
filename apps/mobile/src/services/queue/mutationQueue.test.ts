import { MemoryKeyValueStore } from '../storage/kv';
import { MutationQueue, type Mutation, type SendResult } from './mutationQueue';

const ok: SendResult = { status: 'ok' };

describe('MutationQueue', () => {
  it('persists across a restart (new instance, same store)', () => {
    const store = new MemoryKeyValueStore();
    new MutationQueue(store).enqueue('ritual.start', { schedule_id: 's' }, 'k1');
    const after = new MutationQueue(store);
    expect(after.size()).toBe(1);
    expect(after.peek()[0]?.id).toBe('k1');
  });

  it('keeps the same idempotency key when the same action is enqueued twice', () => {
    const q = new MutationQueue(new MemoryKeyValueStore());
    q.enqueue('ritual.complete', { session_id: 'a' }, 'k1');
    q.enqueue('ritual.complete', { session_id: 'a' }, 'k1');
    expect(q.size()).toBe(1);
  });

  it('flushes in order and empties the queue', async () => {
    const q = new MutationQueue(new MemoryKeyValueStore());
    q.enqueue('ritual.start', {}, 'a');
    q.enqueue('ritual.complete_step', { step_type: 'scripture' }, 'b');
    q.enqueue('ritual.complete', {}, 'c');
    const order: string[] = [];
    const r = await q.flush(async (m: Mutation) => { order.push(m.id); return ok; });
    expect(order).toEqual(['a', 'b', 'c']);
    expect(r).toMatchObject({ sent: 3, remaining: 0, stoppedOnRetry: false });
  });

  it('stops on a network failure and keeps the mutation with the same key for the retry', async () => {
    const q = new MutationQueue(new MemoryKeyValueStore());
    q.enqueue('ritual.start', {}, 'a');
    q.enqueue('ritual.complete', {}, 'b');
    const seen: string[] = [];
    const r1 = await q.flush(async (m) => { seen.push(m.id); return { status: 'retry' }; });
    expect(r1).toMatchObject({ sent: 0, remaining: 2, stoppedOnRetry: true });
    expect(seen).toEqual(['a']);
    expect(q.peek()[0]).toMatchObject({ id: 'a', attempts: 1 });
    const r2 = await q.flush(async (m) => { seen.push(m.id); return ok; });
    expect(seen).toEqual(['a', 'a', 'b']);
    expect(r2.remaining).toBe(0);
  });

  it('drops permanently rejected mutations, records why, and continues', async () => {
    const q = new MutationQueue(new MemoryKeyValueStore());
    q.enqueue('ritual.complete_step', {}, 'bad');
    q.enqueue('ritual.complete', {}, 'good');
    const r = await q.flush(async (m) => (m.id === 'bad' ? { status: 'rejected', code: 'timer_invalid' } : ok));
    expect(r.dropped).toEqual([{ id: 'bad', code: 'timer_invalid', kind: 'ritual.complete_step' }]);
    expect(r.sent).toBe(1);
    expect(q.droppedLog()).toEqual([{ id: 'bad', code: 'timer_invalid', kind: 'ritual.complete_step' }]);
  });

  it('rewrites later mutations when the server replaces a device generated session id', async () => {
    const q = new MutationQueue(new MemoryKeyValueStore());
    q.enqueue('ritual.start', { session_id: 'device-1' }, 'a');
    q.enqueue('ritual.complete_step', { session_id: 'device-1', step_type: 'scripture' }, 'b');
    const seenSessions: unknown[] = [];
    await q.flush(async (m) => {
      seenSessions.push(m.payload.session_id);
      return m.kind === 'ritual.start' ? { status: 'ok', serverSessionId: 'server-9' } : ok;
    });
    expect(seenSessions).toEqual(['device-1', 'server-9']);
  });

  it('does not run two flushes at once', async () => {
    const q = new MutationQueue(new MemoryKeyValueStore());
    q.enqueue('ritual.start', {}, 'a');
    let calls = 0;
    const slow = async (): Promise<SendResult> => { calls++; await new Promise<void>((r) => setTimeout(() => r(), 10)); return ok; };
    await Promise.all([q.flush(slow), q.flush(slow)]);
    expect(calls).toBe(1);
  });
});
