import type { RitualSchedule } from '@rabb/schedule-core';
import type { SupabaseClient } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import type { EmergencyBypass } from './features/ritual/emergencyBypass';
import type { RitualController } from './features/ritual/ritualController';
import type { Analytics } from './services/analytics/analytics';
import type { ApiClient } from './services/api/client';
import type { AppBlockingService } from './services/blocking/types';
import type { DailyContentCache } from './services/content/dailyContent';
import type { MutationQueue } from './services/queue/mutationQueue';
import type { KeyValueStore } from './services/storage/kv';
import type { createSettingsStore } from './stores/settings';

export interface Services {
  /** DEMO MODE: offline, simulated restrictions, placeholder content. Never true in a real build. */
  demo: boolean;
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
  /** DEMO MODE: clears every local value so the journey can be shown again. */
  resetDemo: () => void;
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
