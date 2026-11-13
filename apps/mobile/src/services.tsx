import { ritualDayOf, resolveRestriction, windowsBetween, type RitualSchedule } from '@rabb/schedule-core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { config, functionsBaseUrl } from './config';
import { RitualController } from './features/ritual/ritualController';
import { EmergencyBypass } from './features/ritual/emergencyBypass';
import { Analytics, analytics } from './services/analytics/analytics';
import { createApiClient, type ApiClient } from './services/api/client';
import { createRitualSender } from './services/api/ritualSync';
import { createBlockingService, type AppBlockingService } from './services/blocking';
import { DailyContentCache } from './services/content/dailyContent';
import { MutationQueue } from './services/queue/mutationQueue';
import { createMmkvStore } from './services/storage/mmkv';
import { secureStorageAdapter } from './services/storage/secure';
import type { KeyValueStore } from './services/storage/kv';
import { createSettingsStore } from './stores/settings';
import { uuidv4 } from './utils/id';

export interface Services {
  supabase: SupabaseClient;
  api: ApiClient;
  kv: KeyValueStore;
  queue: MutationQueue;
  cache: DailyContentCache;
  blocking: AppBlockingService;
  analytics: Analytics;
  ritual: RitualController;
  bypass: EmergencyBypass;
  settings: ReturnType<typeof createSettingsStore>;
  /** Latest schedules loaded from the server, used for local window maths. */
  schedules: { current: RitualSchedule[] };
  timeZone: () => string;
  localToday: () => string;
  sync: () => Promise<void>;
  registerWindows: (schedules: RitualSchedule[]) => Promise<void>;
}

export function createServices(): Services {
  const kv = createMmkvStore();
  const supabase = createClient(config.supabaseUrl || 'http://localhost', config.supabaseAnonKey || 'anon', {
    auth: { storage: secureStorageAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  const api = createApiClient({
    baseUrl: functionsBaseUrl(),
    getToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  });
  const queue = new MutationQueue(kv);
  const cache = new DailyContentCache(kv);
  const blocking = createBlockingService();
  const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const localToday = () => ritualDayOf(Date.now(), timeZone());
  const schedules = { current: [] as RitualSchedule[] };
  const settings = createSettingsStore(kv);

  const send = createRitualSender(api);
  const sync = async () => {
    await queue.flush(send);
    ritual.refreshSyncLabel();
  };

  const ritual: RitualController = new RitualController({
    queue,
    blocking,
    analytics,
    newId: uuidv4,
    monotonicNow: () => performance.now(),
    currentLocalDate: localToday,
    suspendUntilMs: () => {
      const s = ritual.state;
      if (!s.scheduleId || !s.localDate) return null;
      const now = Date.now();
      const status = resolveRestriction({
        nowMs: now,
        timeZone: timeZone(),
        schedules: schedules.current,
        completions: [{ scheduleId: s.scheduleId, localDate: s.localDate, completedAtMs: now }],
      });
      return status.suspendedUntilMs;
    },
    triggerSync: () => {
      void sync().catch(() => undefined);
    },
  });

  const bypass = new EmergencyBypass(kv, blocking, analytics, localToday);

  const registerWindows = async (list: RitualSchedule[]) => {
    schedules.current = list;
    const now = Date.now();
    const windows = list.flatMap((s) => windowsBetween(s, timeZone(), now, now + 7 * 86_400_000));
    await blocking.scheduleRestrictions(windows);
  };

  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      ritual.checkRollover();
      void sync().catch(() => undefined);
    }
  });

  return { supabase, api, kv, queue, cache, blocking, analytics, ritual, bypass, settings, schedules, timeZone, localToday, sync, registerWindows };
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: React.ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error('ServicesProvider missing');
  return s;
}

/** Re-renders when the ritual controller emits. */
export function useRitual(): RitualController {
  const { ritual } = useServices();
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => ritual.subscribe(() => force()), [ritual]);
  return ritual;
}
