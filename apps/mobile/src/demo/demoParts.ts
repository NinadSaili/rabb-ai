import type { SupabaseClient } from '@supabase/supabase-js';
import type { WiringParts } from '../serviceWiring';
import type { KeyValueStore } from '../services/storage/kv';
import { createDemoApi } from './demoApi';
import { DemoBlockingService } from './demoBlocking';
import { DEMO_TRANSLATION } from './fixtures';

/** A minimal stand-in for the Supabase client. There is no backend in demo mode. */
function fakeSupabase(): SupabaseClient {
  const session = { access_token: 'demo', user: { id: 'demo-user', is_anonymous: false, email: null } };
  const tables: Record<string, unknown[]> = {
    scripture_translations: [{ code: DEMO_TRANSLATION.code, name: DEMO_TRANSLATION.name, language: DEMO_TRANSLATION.language, license_name: DEMO_TRANSLATION.license_name, attribution_text: DEMO_TRANSLATION.attribution_text, is_dev_only: true }],
  };
  const from = (table: string) => {
    const rows = { data: tables[table] ?? [], error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'order', 'eq', 'limit']) chain[m] = () => chain;
    chain.single = async () => ({ data: null, error: { message: 'demo mode' } });
    (chain as { then: unknown }).then = (res: (v: unknown) => unknown) => Promise.resolve(rows).then(res);
    return chain;
  };
  return {
    auth: {
      getSession: async () => ({ data: { session } }),
      signInAnonymously: async () => ({ data: { session }, error: null }),
      signInWithPassword: async () => ({ error: { message: 'demo mode' } }),
      updateUser: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
      linkIdentity: async () => ({ data: null, error: { message: 'demo mode' } }),
    },
    from,
  } as unknown as SupabaseClient;
}

/** Everything demo mode swaps in: local API, simulated blocking, fake auth. Required only behind the DEMO_MODE build constant. */
export function createDemoParts(kv: KeyValueStore, timeZone: () => string): Omit<WiringParts, 'analytics' | 'monotonicNow'> {
  return { demo: true, kv, supabase: fakeSupabase(), api: createDemoApi(kv, timeZone), blocking: new DemoBlockingService(kv), timeZone };
}
