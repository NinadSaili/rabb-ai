import { z } from 'zod';

/** Form model for a schedule. The window is startHour to startHour + 6 hours by default and applies every day. */
export const scheduleSchema = z.object({
  kind: z.enum(['morning', 'custom']),
  name: z.string().min(1).max(60),
  startHour: z.number().int().min(0).max(23),
  durationHours: z.number().int().min(1).max(24).default(6),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  timerSeconds: z.number().int().min(30).max(3600).nullable(),
  unlockUntilMidnight: z.boolean().default(false),
});
export type ScheduleForm = z.infer<typeof scheduleSchema>;

/** Maps the form to the API body. Only custom schedules may unlock until midnight. */
export function toRequestBody(f: ScheduleForm, idempotencyKey: string) {
  const start = f.startHour * 60;
  const end = Math.min(1440, start + f.durationHours * 60);
  return {
    name: f.name,
    kind: f.kind,
    enabled: true,
    weekdays: f.weekdays,
    start_minute: start,
    end_minute: end > start ? end : 1440,
    timer_seconds: f.timerSeconds,
    unlock_until: f.kind === 'custom' && f.unlockUntilMidnight ? ('midnight' as const) : ('window_end' as const),
    idempotency_key: idempotencyKey,
  };
}
