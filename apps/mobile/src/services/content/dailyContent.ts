import type { DayContent } from '@rabb/contracts';
import { getJson, setJson, type KeyValueStore } from '../storage/kv';

const KEY = 'rabb.content.days.v1';

/**
 * Offline cache for daily content: today plus the next 7 days prefetched from GET /v1/daily/ritual.
 * Past days are pruned. Attribution travels with every verse so the reader can always render it.
 */
export class DailyContentCache {
  constructor(private readonly store: KeyValueStore) {}

  save(days: DayContent[], today: string): void {
    const merged = new Map<string, DayContent>();
    for (const d of getJson<DayContent[]>(this.store, KEY, [])) merged.set(d.local_date, d);
    for (const d of days) merged.set(d.local_date, d);
    const kept = [...merged.values()].filter((d) => d.local_date >= today).sort((a, b) => a.local_date.localeCompare(b.local_date));
    setJson(this.store, KEY, kept);
  }

  get(localDate: string): DayContent | undefined {
    return getJson<DayContent[]>(this.store, KEY, []).find((d) => d.local_date === localDate);
  }

  dates(): string[] {
    return getJson<DayContent[]>(this.store, KEY, []).map((d) => d.local_date);
  }
}

/** Deterministic fallback rotation. Mirrors public.select_daily_verse: days since 2000-01-01 modulo the list size. */
export function fallbackIndex(localDate: string, listSize: number): number {
  if (listSize <= 0) throw new RangeError('empty fallback list');
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2000, 0, 1)) / 86_400_000);
  return ((days % listSize) + listSize) % listSize;
}

/** Providers decide where scripture comes from. Release builds only ever register licensed providers. */
export interface ScriptureProvider {
  readonly id: string;
  /** Licence verified for release (docs/SCRIPTURE_LICENSING.md). DEV ONLY fixtures return false. */
  readonly releaseApproved: boolean;
  getDay(localDate: string): Promise<DayContent | null>;
}

/** Cache first, then the API. Works offline for every cached date. */
export class CachedApiScriptureProvider implements ScriptureProvider {
  readonly id = 'api-cache';
  readonly releaseApproved = true; // content comes from the server, where the release gate constraint applies
  constructor(private readonly cache: DailyContentCache, private readonly fetchDays: () => Promise<{ today: string; days: DayContent[] }>) {}

  async getDay(localDate: string): Promise<DayContent | null> {
    const hit = this.cache.get(localDate);
    if (hit) return hit;
    try {
      const { today, days } = await this.fetchDays();
      this.cache.save(days, today);
    } catch {
      return null;
    }
    return this.cache.get(localDate) ?? null;
  }
}
