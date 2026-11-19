import type { ApiClient } from '../../services/api/client';
import { ApiError } from '../../services/api/client';
import { DailyContentCache } from '../../services/content/dailyContent';
import { MemoryKeyValueStore } from '../../services/storage/kv';
import { loadDailyRitual } from './loadDaily';

const day = (date: string) => ({
  local_date: date,
  verse: { id: '123e4567-e89b-42d3-a456-426614174000', reference: { book: 'PSA', chapter: 23, verse_start: 1 }, text: 'v', translation: { code: 'KJV-DEV', name: 'n', language: 'en', license_name: 'l', copyright_text: 'c', attribution_text: 'a' }, theme: null },
  prayer: { id: '223e4567-e89b-42d3-a456-426614174000', title: 't', body: 'b', language: 'en' },
});
const response = { local_date: '2026-03-10', timezone: 'UTC', days: [day('2026-03-10'), day('2026-03-11')], schedule_id: '323e4567-e89b-42d3-a456-426614174000', timer_seconds: 60, session: null, server_time: '2026-03-10T10:00:00Z' };

describe('loadDailyRitual', () => {
  it('uses the network, refreshes the cache and remembers schedule metadata', async () => {
    const kv = new MemoryKeyValueStore();
    const cache = new DailyContentCache(kv);
    const api = { get: async () => response, post: async () => ({}) } as unknown as ApiClient;
    const v = await loadDailyRitual(api, cache, kv, () => '2026-03-10');
    expect(v).toMatchObject({ source: 'network', offline: false, timerSeconds: 60 });
    expect(cache.dates()).toEqual(['2026-03-10', '2026-03-11']);
  });
  it('runs offline from cache: content, schedule and timer come from the last sync', async () => {
    const kv = new MemoryKeyValueStore();
    const cache = new DailyContentCache(kv);
    await loadDailyRitual({ get: async () => response } as unknown as ApiClient, cache, kv, () => '2026-03-10');
    const offlineApi = { get: async () => { throw new ApiError('network', 0, 'offline', null); } } as unknown as ApiClient;
    const v = await loadDailyRitual(offlineApi, cache, kv, () => '2026-03-11');
    expect(v).toMatchObject({ source: 'cache', offline: true, localDate: '2026-03-11', timerSeconds: 60 });
    expect(v.today.verse.translation.attribution_text).toBe('a');
  });
  it('fails honestly when offline with nothing cached', async () => {
    const kv = new MemoryKeyValueStore();
    const offlineApi = { get: async () => { throw new ApiError('network', 0, 'offline', null); } } as unknown as ApiClient;
    await expect(loadDailyRitual(offlineApi, new DailyContentCache(kv), kv, () => '2026-03-10')).rejects.toBeInstanceOf(ApiError);
  });
});
