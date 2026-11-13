import { z } from 'zod';
import { isoDate } from './common';

export const dayStatus = z.enum(['completed', 'grace', 'missed', 'pending', 'none']);

export const habitsSummaryResponse = z.object({
  local_date: isoDate,
  current_streak: z.number().int().min(0),
  longest_streak: z.number().int().min(0),
  grace_days_per_week: z.number().int().min(0),
  week: z.array(z.object({ date: isoDate, status: dayStatus })).length(7),
  completed_last_30_days: z.number().int().min(0).max(30),
  total_completed: z.number().int().min(0),
});
