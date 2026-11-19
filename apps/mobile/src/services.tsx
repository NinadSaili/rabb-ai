import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { config, functionsBaseUrl } from './config';
import { analytics } from './services/analytics/analytics';
import { createApiClient } from './services/api/client';
import { createBlockingService } from './services/blocking';
import { createMmkvStore } from './services/storage/mmkv';
import { secureStorageAdapter } from './services/storage/secure';
import { wireServices } from './serviceWiring';
import type { Services } from './serviceContext';

export { ServicesProvider, useRitual, useServices, type Services } from './serviceContext';

/** DEMO_MODE is inlined from the build environment. Demo code is required only behind this constant. */
export const DEMO_MODE = process.env.DEMO_MODE === '1';

export function createServices(): Services {
  const kv = createMmkvStore();
  const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let services: Services;

  // The comparison is written inline on purpose: the build inlines the environment value, Metro folds the constant condition,
  // and the demo modules (placeholder scripture) are dropped from non-demo bundles.
  if (process.env.DEMO_MODE === '1') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createDemoParts } = require('./demo/demoParts') as typeof import('./demo/demoParts');
    services = wireServices({ ...createDemoParts(kv, timeZone), analytics, monotonicNow: () => performance.now() });
  } else {
    const supabase = createClient(config.supabaseUrl || 'http://localhost', config.supabaseAnonKey || 'anon', {
      auth: { storage: secureStorageAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
    const api = createApiClient({
      baseUrl: functionsBaseUrl(),
      getToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
    });
    services = wireServices({ demo: false, kv, supabase, api, blocking: createBlockingService(), analytics, timeZone, monotonicNow: () => performance.now() });
  }

  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      services.ritual.checkRollover();
      void services.sync().catch(() => undefined);
    }
  });
  return services;
}
