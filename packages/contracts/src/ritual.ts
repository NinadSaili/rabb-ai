import { z } from 'zod';
import { clientTimestamp, idempotencyKey, isoDate, isoTimestamp, scriptureReference, translationMeta, uuid } from './common.ts';

export const stepType = z.enum(['scripture', 'prayer', 'timer']);
export type StepType = z.infer<typeof stepType>;

export const sessionStatus = z.enum(['in_progress', 'completed', 'abandoned', 'expired']);

export const dailyRitualQuery = z.object({
  schedule_id: uuid.optional(),
  translation: z.string().min(2).max(12).optional(),
  /** Extra days after today for the offline cache. Default 7. */
  prefetch_days: z.coerce.number().int().min(0).max(7).default(7),
});

export const dayContent = z.object({
  local_date: isoDate,
  verse: z.object({
    id: uuid,
    reference: scriptureReference,
    text: z.string(),
    translation: translationMeta,
    theme: z.string().nullable(),
  }),
  prayer: z.object({ id: uuid, title: z.string(), body: z.string(), language: z.string() }),
});
export type DayContent = z.infer<typeof dayContent>;

export const dailyRitualResponse = z.object({
  /** Server computed ritual date (03:00 local boundary in the profile timezone). */
  local_date: isoDate,
  timezone: z.string(),
  /** days[0] is today. Remaining entries are the prefetch window. */
  days: z.array(dayContent).min(1).max(8),
  schedule_id: uuid,
  timer_seconds: z.number().int().positive().nullable(),
  session: z
    .object({ id: uuid, status: sessionStatus, completed_steps: z.array(stepType) })
    .nullable(),
  server_time: isoTimestamp,
});

export const startRequest = z.object({
  schedule_id: uuid,
  /** Optional device generated id so a session created offline can queue steps before the first sync. */
  session_id: uuid.optional(),
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
  /** True when the step waited in the offline queue. The timer is then stored unverified (device attested). */
  offline_queued: z.boolean().default(false),
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
