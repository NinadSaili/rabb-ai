import { ritualDayOf, suspensionAfterCompletion, windowsBetween, type RitualSchedule } from '@rabb/schedule-core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Services } from './serviceContext';
import { EmergencyBypass } from './features/ritual/emergencyBypass';
import { RitualController } from './features/ritual/ritualController';
import type { Analytics } from './services/analytics/analytics';
import type { ApiClient } from './services/api/client';
import { createRitualSender } from './services/api/ritualSync';
import type { AppBlockingService } from './services/blocking/types';
import { DailyContentCache } from './services/content/dailyContent';
import { MutationQueue } from './services/queue/mutationQueue';
import type { KeyValueStore } from './services/storage/kv';
import { createSettingsStore } from './stores/settings';
import { uuidv4 } from './utils/id';

export interface WiringParts {
  demo: boolean;
  kv: KeyValueStore;
  supabase: SupabaseClient;
  api: ApiClient;
  blocking: AppBlockingService;
  analytics: Analytics;
  timeZone: () => string;
  /** Monotonic milliseconds. performance.now on a device. */
  monotonicNow: () => number;
  nowMs?: () => number;
  /** Called after enqueueing a mutation. Defaults to a best effort background sync. */
  autoSync?: boolean;
}

/** Builds the app services without touching any native module, so it is shared by the real app, demo mode and Jest. */
export function wireServices(p: WiringParts): Services {
  const nowMs = p.nowMs ?? Date.now;
  const queue = new MutationQueue(p.kv, nowMs);
  const cache = new DailyContentCache(p.kv);
  const settings = createSettingsStore(p.kv);
  const schedules = { current: [] as RitualSchedule[] };
  const localToday = () => ritualDayOf(nowMs(), p.timeZone());
  const send = createRitualSender(p.api);

  const sync = async () => {
    const report = await queue.flush(send);
    ritual.noteFlush(report);
    ritual.refreshSyncLabel();
  };

  const ritual: RitualController = new RitualController({
    queue,
    blocking: p.blocking,
    analytics: p.analytics,
    newId: uuidv4,
    monotonicNow: p.monotonicNow,
    currentLocalDate: localToday,
    suspendUntilMs: () => {
      const s = ritual.state;
      const schedule = schedules.current.find((x) => x.id === s.scheduleId);
      return schedule ? suspensionAfterCompletion({ nowMs: nowMs(), timeZone: p.timeZone(), schedule }) : null;
    },
    triggerSync: () => {
      if (p.autoSync !== false) void sync().catch(() => undefined);
    },
  });

  const bypass = new EmergencyBypass(p.kv, p.blocking, p.analytics, localToday, nowMs);

  const registerWindows = async (list: RitualSchedule[]) => {
    schedules.current = list;
    // User controlled off switch: no windows are registered while blocking is turned off.
    if (!settings.getState().blockingEnabled) {
      await p.blocking.disableBlocking();
      return;
    }
    const now = nowMs();
    const windows = list.flatMap((s) => windowsBetween(s, p.timeZone(), now, now + 7 * 86_400_000));
    await p.blocking.scheduleRestrictions(windows);
  };

  const resetDemo = () => {
    for (const k of p.kv.keys()) p.kv.delete(k);
    ritual.reset();
  };

  return {
    resetDemo,
    demo: p.demo, supabase: p.supabase, api: p.api, kv: p.kv, queue, cache, blocking: p.blocking, analytics: p.analytics,
    ritual, bypass, settings, schedules, timeZone: p.timeZone, localToday, sync, registerWindows,
  };
}
