/** Non sensitive key value cache. Production uses MMKV. Tokens never go through this interface (see secure.ts). */
export interface KeyValueStore {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  keys(): string[];
}

export class MemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  getString(key: string): string | undefined {
    return this.data.get(key);
  }
  set(key: string, value: string): void {
    this.data.set(key, value);
  }
  delete(key: string): void {
    this.data.delete(key);
  }
  keys(): string[] {
    return [...this.data.keys()];
  }
}

export function getJson<T>(store: KeyValueStore, key: string, fallback: T): T {
  const raw = store.getString(key);
  if (raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJson(store: KeyValueStore, key: string, value: unknown): void {
  store.set(key, JSON.stringify(value));
}
