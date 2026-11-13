import { MemoryKeyValueStore } from '../services/storage/kv';
import { createSettingsStore, DEFAULT_SETTINGS } from './settings';

describe('settings store', () => {
  it('keeps UI language and Bible translation independent and persists them', () => {
    const kv = new MemoryKeyValueStore();
    const s = createSettingsStore(kv);
    s.getState().update({ translationCode: 'BSB' });
    expect(s.getState().uiLanguage).toBe('en');
    s.getState().update({ uiLanguage: 'es' });
    const reloaded = createSettingsStore(kv);
    expect(reloaded.getState()).toMatchObject({ uiLanguage: 'es', translationCode: 'BSB' });
  });
  it('has no premium flag anywhere in persisted settings', () => {
    const kv = new MemoryKeyValueStore();
    createSettingsStore(kv).getState().update({ onboardingDone: true });
    expect(Object.keys(DEFAULT_SETTINGS).join(',')).not.toMatch(/premium|entitle|subscri/i);
    expect(kv.getString('rabb.settings.v1')).not.toMatch(/premium|entitle|subscri/i);
  });
});
