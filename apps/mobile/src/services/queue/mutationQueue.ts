import { getJson, setJson, type KeyValueStore } from '../storage/kv';

export type MutationKind = 'ritual.start' | 'ritual.complete_step' | 'ritual.complete';

export interface Mutation {
  /** Also the idempotency key sent to the server. Generated once when the action is enqueued, reused on every retry. */
  id: string;
  kind: MutationKind;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
}

export type SendResult =
  | { status: 'ok'; serverSessionId?: string }
  /** Network down, timeout or 5xx. Keep the mutation and stop. */
  | { status: 'retry' }
  /** 4xx the server will never accept (validation, illegal transition, timer invalid). Drop with a record. */
  | { status: 'rejected'; code: string };

export type Sender = (m: Mutation) => Promise<SendResult>;

export interface DroppedMutation {
  id: string;
  code: string;
  kind: MutationKind;
}

export interface FlushReport {
  sent: number;
  dropped: DroppedMutation[];
  remaining: number;
  stoppedOnRetry: boolean;
}

const KEY = 'rabb.mutation_queue.v1';
const DROPPED_KEY = 'rabb.mutation_queue.dropped.v1';

/**
 * Persistent, ordered mutation queue. Order matters because steps depend on earlier steps.
 * First completion wins on the server, so replaying an already applied mutation is always safe.
 */
export class MutationQueue {
  private flushing = false;
  constructor(private readonly store: KeyValueStore, private readonly now: () => number = Date.now) {}

  private read(): Mutation[] {
    return getJson<Mutation[]>(this.store, KEY, []);
  }
  private write(items: Mutation[]): void {
    setJson(this.store, KEY, items);
  }

  enqueue(kind: MutationKind, payload: Record<string, unknown>, id: string): Mutation {
    const items = this.read();
    const existing = items.find((m) => m.id === id);
    if (existing) return existing;
    const m: Mutation = { id, kind, payload, createdAt: this.now(), attempts: 0 };
    this.write([...items, m]);
    return m;
  }

  size(): number {
    return this.read().length;
  }
  peek(): Mutation[] {
    return this.read();
  }
  droppedLog(): DroppedMutation[] {
    return getJson(this.store, DROPPED_KEY, []);
  }

  /** Rewrites later mutations when the server replaces a device generated session id. */
  rewriteSessionId(from: string, to: string): void {
    this.write(this.read().map((m) => (m.payload.session_id === from ? { ...m, payload: { ...m.payload, session_id: to } } : m)));
  }

  async flush(send: Sender): Promise<FlushReport> {
    const report: FlushReport = { sent: 0, dropped: [], remaining: 0, stoppedOnRetry: false };
    if (this.flushing) return { ...report, remaining: this.size() };
    this.flushing = true;
    try {
      for (;;) {
        const head = this.read()[0];
        if (!head) break;
        const result = await send({ ...head, attempts: head.attempts + 1 });
        if (result.status === 'retry') {
          this.write(this.read().map((m, i) => (i === 0 ? { ...m, attempts: m.attempts + 1 } : m)));
          report.stoppedOnRetry = true;
          break;
        }
        const rest = this.read().slice(1);
        this.write(rest);
        if (result.status === 'ok') {
          report.sent++;
          if (result.serverSessionId && head.kind === 'ritual.start' && typeof head.payload.session_id === 'string' && head.payload.session_id !== result.serverSessionId) {
            this.rewriteSessionId(head.payload.session_id, result.serverSessionId);
          }
        } else {
          const entry: DroppedMutation = { id: head.id, code: result.code, kind: head.kind };
          report.dropped.push(entry);
          setJson(this.store, DROPPED_KEY, [...this.droppedLog(), entry].slice(-50));
        }
      }
    } finally {
      this.flushing = false;
    }
    report.remaining = this.size();
    return report;
  }
}
