import { resolveDeepLink } from './deepLinks';
import { features } from '../config';
import { en } from '../i18n/en';

describe('deep links (used by the Android block screen)', () => {
  it('opens the ritual and the emergency bypass once onboarding is done', () => {
    expect(resolveDeepLink('rabbai://ritual', true)).toEqual({ kind: 'ritual' });
    expect(resolveDeepLink('rabbai://privacy', true)).toEqual({ kind: 'privacy' });
    expect(resolveDeepLink('rabbai://privacy/?from=block#x', true)).toEqual({ kind: 'privacy' });
  });
  it('ignores every link before onboarding finishes so permission disclosures cannot be skipped', () => {
    expect(resolveDeepLink('rabbai://ritual', false)).toBeNull();
    expect(resolveDeepLink('rabbai://privacy', false)).toBeNull();
  });
  it('ignores unknown, foreign and malformed links', () => {
    for (const u of ['rabbai://settings', 'https://rabb.ai/ritual', 'rabbai:ritual', '', null, undefined, 'rabbai://ritual/../x']) {
      expect(resolveDeepLink(u as never, true)).toBeNull();
    }
  });
});

describe('MVP surface', () => {
  it('premium surfaces are off in the MVP', () => {
    expect(features.premiumUi).toBe(false);
  });
  it('tab labels are the five agreed tabs', () => {
    expect(Object.values(en.tabs)).toEqual(['Home', 'Read', 'Pray', 'Journey', 'Profile']);
  });
});
