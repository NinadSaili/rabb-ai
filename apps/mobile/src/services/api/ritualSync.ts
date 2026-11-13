import { completeResponse, completeStepResponse, startResponse } from '@rabb/contracts';
import type { Mutation, SendResult, Sender } from '../queue/mutationQueue';
import { ApiError, type ApiClient } from './client';

/**
 * Turns queued mutations into API calls. The mutation id is the idempotency key, so a retry after a timeout
 * can never double apply. A mutation that already failed once is flagged offline_queued: the server then stores
 * a timer step as unverified (device attested) instead of rejecting it for missing server elapsed time.
 */
export function createRitualSender(api: ApiClient): Sender {
  return async (m: Mutation): Promise<SendResult> => {
    try {
      switch (m.kind) {
        case 'ritual.start': {
          const r = await api.post('/v1/ritual/start', { ...m.payload, idempotency_key: m.id }, startResponse);
          return { status: 'ok', serverSessionId: r.session_id };
        }
        case 'ritual.complete_step':
          await api.post('/v1/ritual/complete-step', { ...m.payload, idempotency_key: m.id, offline_queued: m.attempts > 1 }, completeStepResponse);
          return { status: 'ok' };
        case 'ritual.complete':
          await api.post('/v1/ritual/complete', { ...m.payload, idempotency_key: m.id }, completeResponse);
          return { status: 'ok' };
      }
    } catch (e) {
      if (e instanceof ApiError) return e.retryable ? { status: 'retry' } : { status: 'rejected', code: e.code };
      return { status: 'retry' };
    }
  };
}
