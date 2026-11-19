import { z } from 'zod';
import { idempotencyKey, uuid } from './common.ts';

export const schedule = z.object({
  id: uuid,
  name: z.string().min(1).max(60),
  kind: z.enum(['morning', 'custom']),
  enabled: z.boolean(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  start_minute: z.number().int().min(0).max(1439),
  end_minute: z.number().int().min(1).max(1440),
  timer_seconds: z.number().int().min(30).max(3600).nullable(),
  unlock_until: z.enum(['window_end', 'midnight']),
});
export type Schedule = z.infer<typeof schedule>;

export const schedulesResponse = z.object({ schedules: z.array(schedule) });

export const createScheduleRequest = schedule.omit({ id: true }).extend({ idempotency_key: idempotencyKey });
export const createScheduleResponse = schedule.extend({ replayed: z.boolean() });
