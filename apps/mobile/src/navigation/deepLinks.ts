/**
 * Deep links used by the Android block screen: rabbai://ritual (open Rabb.ai) and rabbai://privacy (emergency bypass).
 * Links are ignored until onboarding is finished, so a link can never skip onboarding or the permission disclosures.
 * Pure function so it can be tested without a navigator.
 */
export type DeepLinkTarget = { kind: 'ritual' } | { kind: 'privacy' };

export function resolveDeepLink(url: string | null | undefined, onboardingDone: boolean): DeepLinkTarget | null {
  if (!url || !onboardingDone) return null;
  const m = /^rabbai:\/\/([a-z]+)\/?(?:[?#].*)?$/i.exec(url.trim());
  if (!m) return null;
  switch (m[1]?.toLowerCase()) {
    case 'ritual': return { kind: 'ritual' };
    case 'privacy': return { kind: 'privacy' };
    default: return null;
  }
}
