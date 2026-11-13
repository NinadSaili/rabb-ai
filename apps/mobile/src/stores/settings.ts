import { create } from 'zustand';
import { getJson, setJson, type KeyValueStore } from '../services/storage/kv';

export interface Settings {
  uiLanguage: string;
  translationCode: string;
  readingScale: number;
  ageConfirmed: boolean;
  onboardingDone: boolean;
  morningReminder: boolean;
  missedNudge: boolean;
  /** User controlled off switch for app blocking. When false the app registers no restriction windows. */
  blockingEnabled: boolean;
  /** Epoch ms until which the user wants the "premium" paywall hidden is NOT stored. There is no premium flag. */
}

export const DEFAULT_SETTINGS: Settings = {
  uiLanguage: 'en',
  translationCode: 'WEB',
  readingScale: 1,
  ageConfirmed: false,
  onboardingDone: false,
  morningReminder: true,
  missedNudge: false,
  blockingEnabled: true,
};

const KEY = 'rabb.settings.v1';

export function createSettingsStore(kv: KeyValueStore) {
  return create<Settings & { update: (patch: Partial<Settings>) => void }>((set, get) => ({
    ...DEFAULT_SETTINGS,
    ...getJson<Partial<Settings>>(kv, KEY, {}),
    update: (patch) => {
      set(patch);
      const { update: _u, ...rest } = get();
      void _u;
      setJson(kv, KEY, rest);
    },
  }));
}
