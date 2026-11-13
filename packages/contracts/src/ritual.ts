import { z } from 'zod';
import { clientTimestamp, idempotencyKey, isoDate, isoTimestamp, scriptureReference, translationMeta, uuid } from './common';

export const stepType = z.enum(['scripture', 'prayer', 'timer']);
export type StepType = z.infer<typeof stepType>;

export const sessionStatus = z.enum(['in_progress', 'completed', 'abandoned', 'expired']);

export const dailyRitualQuery = z.object({
  schedule_id: uuid.optional(),
  translation: z.string().min(2).max(12).optional(),
});

export const dailyRitualResponse = z.object({
  local_date: isoDate,
  timezone: z.string(),
  verse: z.object({
    id: uuid,
    reference: scriptureReference,
    text: z.string(),
    translation: translationMeta,
    theme: z.string().nullable(),
  }),
  prayer: z.object({ id: uuid, title: z.string(), body: z.string(), language: z.string() }),
  timer_seconds: z.number().int().positive().nullable(),
  session: z
    .object({ id: uuid, status: sessionStatus, completed_steps: z.array(stepType) })
    .nullable(),
  /** Today plus the next days, for the offline cache. */
  prefetch_dates: z.array(isoDate),
  server_time: isoTimestamp,
});

export const startRequest = z.object({
  schedule_id: uuid,
  idempotency_key: idempotencyKey,
  client_timestamp: clientTimestamp,
});
export const startResponse = z.object({
  session_id: uuid,
  local_date: isoDate,
  status: sessionStatus,
  timer_seconds: z.number().int().positive().nullable(),
  /** True when this response replays an earlier identical request. */
  replayed: z.boolean(),
});

export const completeStepRequest = z.object({
  session_id: uuid,
  step_type: stepType,
  idempotency_key: idempotencyKey,
  /** Monotonic device duration in milliseconds. Required for the timer step. */
  monotonic_ms: z.number().int().min(0).max(24 * 3600 * 1000).optional(),
  client_timestamp: clientTimestamp,
});
export const completeStepResponse = z.object({
  session_id: uuid,
  step_type: stepType,
  completed_steps: z.array(stepType),
  timer_verified: z.boolean().nullable(),
  replayed: z.boolean(),
});

export const completeRequest = z.object({
  session_id: uuid,
  idempotency_key: idempotencyKey,
  client_timestamp: clientTimestamp,
});
export const completeResponse = z.object({
  session_id: uuid,
  local_date: isoDate,
  status: sessionStatus,
  completed_at: isoTimestamp,
  /** True when an earlier completion for the same schedule and date won. */
  first_completion_won: z.boolean(),
  current_streak: z.number().int().min(0),
  longest_streak: z.number().int().min(0),
  replayed: z.boolean(),
});
