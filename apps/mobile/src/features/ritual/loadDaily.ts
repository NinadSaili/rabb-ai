import { dailyRitualResponse, type DayContent } from '@rabb/contracts';
import type { ApiClient } from '../../services/api/client';
import type { DailyContentCache } from '../../services/content/dailyContent';
import { getJson, setJson, type KeyValueStore } from '../../services/storage/kv';

const META = 'rabb.ritual.meta.v1';

export interface DailyRitualView {
  source: 'network' | 'cache';
  offline: boolean;
  localDate: string;
  today: DayContent;
  scheduleId: string;
  timerSeconds: number | null;
  /** Server session summary. Unknown when read from the cache. */
  session: { id: string; status: string; completed_steps: string[] } | null;
}

/** Network first (and refresh the 7 day cache). Offline, today's cached content lets the ritual run end to end. */
export async function loadDailyRitual(api: ApiClient, cache: DailyContentCache, kv: KeyValueStore, localToday: () => string): Promise<DailyRitualView> {
  try {
    const r = await api.get('/v1/daily/ritual', dailyRitualResponse, { prefetch_days: 7 });
    cache.save(r.days, r.local_date);
    setJson(kv, META, { scheduleId: r.schedule_id, timerSeconds: r.timer_seconds });
    return { source: 'network', offline: false, localDate: r.local_date, today: r.days[0] as DayContent, scheduleId: r.schedule_id, timerSeconds: r.timer_seconds, session: r.session };
  } catch (e) {
    const meta = getJson<{ scheduleId: string; timerSeconds: number | null } | null>(kv, META, null);
    const date = localToday();
    const day = cache.get(date);
    if (!meta || !day) throw e;
    return { source: 'cache', offline: true, localDate: date, today: day, scheduleId: meta.scheduleId, timerSeconds: meta.timerSeconds, session: null };
  }
}
