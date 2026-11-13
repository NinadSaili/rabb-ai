import { subscriptionStatusResponse, type SubscriptionStatus } from '@rabb/contracts';
import type { ApiClient } from './client';

/** Premium is whatever the server says. There is no local premium flag anywhere in the app. */
export function hasPremium(status: SubscriptionStatus | undefined | null): boolean {
  return !!status && status.entitlement === 'premium' && status.active === true;
}

export function fetchSubscriptionStatus(api: ApiClient): Promise<SubscriptionStatus> {
  return api.get('/v1/subscription/status', subscriptionStatusResponse);
}
