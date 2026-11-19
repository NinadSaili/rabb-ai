import { createScheduleResponse, schedulesResponse, type Schedule } from '@rabb/contracts';
import type { RitualSchedule } from '@rabb/schedule-core';
import type { ApiClient } from '../../services/api/client';
import { toRequestBody, type ScheduleForm } from './form';

export async function createSchedule(api: ApiClient, form: ScheduleForm, key: string) {
  return api.post('/v1/schedules', toRequestBody(form, key), createScheduleResponse);
}

export async function listSchedules(api: ApiClient): Promise<Schedule[]> {
  return (await api.get('/v1/schedules', schedulesResponse)).schedules;
}

export function toCoreSchedule(s: Schedule): RitualSchedule {
  return { id: s.id, enabled: s.enabled, weekdays: s.weekdays, startMinute: s.start_minute, endMinute: s.end_minute, unlockUntil: s.unlock_until };
}
