import { uuidv4 } from './id';

describe('uuidv4', () => {
  it('produces valid, unique version 4 UUIDs', () => {
    (globalThis as unknown as { crypto?: unknown }).crypto ??= { getRandomValues: (a: Uint8Array) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; } };
    const ids = new Set(Array.from({ length: 200 }, uuidv4));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
