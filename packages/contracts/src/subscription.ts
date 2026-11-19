import { z } from 'zod';
import { isoTimestamp } from './common.ts';

export const subscriptionStatusResponse = z.object({
  entitlement: z.enum(['free', 'premium']),
  active: z.boolean(),
  product_id: z.string().nullable(),
  store: z.enum(['app_store', 'play_store']).nullable(),
  is_trial: z.boolean(),
  will_renew: z.boolean().nullable(),
  expires_at: isoTimestamp.nullable(),
});
export type SubscriptionStatus = z.infer<typeof subscriptionStatusResponse>;

/** Subset of the RevenueCat webhook body used by the function. Unknown fields are ignored. */
export const revenueCatEvent = z.object({
  api_version: z.string().optional(),
  event: z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    app_user_id: z.string().min(1),
    original_app_user_id: z.string().optional(),
    product_id: z.string().optional(),
    entitlement_ids: z.array(z.string()).nullish(),
    period_type: z.string().optional(),
    store: z.string().optional(),
    expiration_at_ms: z.number().nullish(),
    event_timestamp_ms: z.number(),
    environment: z.string().optional(),
  }),
});
export type RevenueCatEvent = z.infer<typeof revenueCatEvent>;
