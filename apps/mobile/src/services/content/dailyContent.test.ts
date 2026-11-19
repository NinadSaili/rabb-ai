import type { DayContent } from '@rabb/contracts';
import { MemoryKeyValueStore } from '../storage/kv';
import { CachedApiScriptureProvider, DailyContentCache, fallbackIndex } from './dailyContent';

const day = (date: string): DayContent => ({
  local_date: date,
  verse: {
    id: '123e4567-e89b-42d3-a456-426614174000',
    reference: { book: 'PSA', chapter: 23, verse_start: 1 },
    text: 'The LORD is my shepherd; I shall not want.',
    translation: { code: 'KJV-DEV', name: 'KJV', language: 'en', license_name: 'DEV ONLY', copyright_text: 'c', attribution_text: 'a' },
    theme: null,
  },
  prayer: { id: '223e4567-e89b-42d3-a456-426614174000', title: 't', body: 'b', language: 'en' },
});
const week = (from: number) => Array.from({ length: 8 }, (_, i) => day(`2026-03-${String(from + i).padStart(2, '0')}`));

describe('DailyContentCache', () => {
  it('stores today plus the 7 day prefetch and serves it offline', () => {
    const c = new DailyContentCache(new MemoryKeyValueStore());
    c.save(week(10), '2026-03-10');
    expect(c.dates()).toHaveLength(8);
    expect(c.get('2026-03-17')?.verse.translation.attribution_text).toBe('a');
  });
  it('prunes past days and merges overlapping windows', () => {
    const c = new DailyContentCache(new MemoryKeyValueStore());
    c.save(week(10), '2026-03-10');
    c.save(week(12), '2026-03-12');
    expect(c.dates()[0]).toBe('2026-03-12');
    expect(c.dates()).toHaveLength(8);
    expect(c.get('2026-03-10')).toBeUndefined();
  });
  it('survives a restart', () => {
    const store = new MemoryKeyValueStore();
    new DailyContentCache(store).save(week(10), '2026-03-10');
    expect(new DailyContentCache(store).get('2026-03-10')).toBeDefined();
  });
});

describe('fallbackIndex', () => {
  it('is deterministic and rotates daily (mirrors SQL: days since 2000-01-01 mod n)', () => {
    expect(fallbackIndex('2000-01-01', 6)).toBe(0);
    expect(fallbackIndex('2000-01-07', 6)).toBe(0);
    expect(fallbackIndex('2026-05-03', 3)).toBe(fallbackIndex('2026-05-03', 3));
    expect(fallbackIndex('2026-05-03', 3)).not.toBe(fallbackIndex('2026-05-04', 3));
  });
  it('rejects an empty list', () => expect(() => fallbackIndex('2026-01-01', 0)).toThrow());
});

describe('CachedApiScriptureProvider', () => {
  it('answers from the cache without calling the network', async () => {
    const cache = new DailyContentCache(new MemoryKeyValueStore());
    cache.save(week(10), '2026-03-10');
    const fetchDays = jest.fn();
    expect(await new CachedApiScriptureProvider(cache, fetchDays).getDay('2026-03-11')).not.toBeNull();
    expect(fetchDays).not.toHaveBeenCalled();
  });
  it('fetches when the date is missing and returns null when offline', async () => {
    const cache = new DailyContentCache(new MemoryKeyValueStore());
    const online = new CachedApiScriptureProvider(cache, async () => ({ today: '2026-03-10', days: week(10) }));
    expect((await online.getDay('2026-03-10'))?.local_date).toBe('2026-03-10');
    const offline = new CachedApiScriptureProvider(new DailyContentCache(new MemoryKeyValueStore()), async () => { throw new Error('offline'); });
    expect(await offline.getDay('2026-03-10')).toBeNull();
  });
});
