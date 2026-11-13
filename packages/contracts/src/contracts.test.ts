import { ENDPOINTS, apiError, completeStepRequest, tutorBlock, tutorRequest, deleteAccountRequest } from './index.ts';

const uuid = '123e4567-e89b-42d3-a456-426614174000';

describe('contracts', () => {
  it('registers every required endpoint', () => {
    const keys = ENDPOINTS.map((e) => `${e.method} ${e.path}`);
    for (const k of [
      'GET /v1/daily/ritual', 'POST /v1/ritual/start', 'POST /v1/ritual/complete-step', 'POST /v1/ritual/complete',
      'GET /v1/habits/summary', 'GET /v1/schedules', 'POST /v1/schedules', 'POST /v1/learning/quiz',
      'POST /v1/learning/answer', 'POST /v1/ai/tutor', 'GET /v1/subscription/status', 'POST /v1/account/delete',
      'POST /revenuecat-webhook',
    ]) expect(keys).toContain(k);
  });
  it('mutations require an idempotency key', () => {
    expect(completeStepRequest.safeParse({ session_id: uuid, step_type: 'prayer' }).success).toBe(false);
    expect(completeStepRequest.safeParse({ session_id: uuid, step_type: 'prayer', idempotency_key: uuid }).success).toBe(true);
  });
  it('tutor blocks only allow the two verified types', () => {
    expect(tutorBlock.safeParse({ type: 'prophecy', text: 'x' }).success).toBe(false);
    expect(tutorBlock.safeParse({ type: 'scripture', reference: { book: 'JHN', chapter: 3, verse_start: 16 }, translation: 'WEB', text: 'x', verified: false }).success).toBe(false);
  });
  it('tutor message length is capped', () => {
    expect(tutorRequest.safeParse({ message: 'a'.repeat(2001) }).success).toBe(false);
  });
  it('account deletion needs an explicit confirmation literal', () => {
    expect(deleteAccountRequest.safeParse({ confirm: 'yes' }).success).toBe(false);
  });
  it('error envelope has code, message and request id', () => {
    expect(apiError.safeParse({ error: { code: 'rate_limited', message: 'm', request_id: 'r' } }).success).toBe(true);
    expect(apiError.safeParse({ error: { code: 'rate_limited', message: 'm' } }).success).toBe(false);
  });
});
