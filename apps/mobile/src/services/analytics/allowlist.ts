/**
 * Analytics allow list. Events and properties outside this table are rejected.
 * Property values are enums, counts (integers) and booleans only. No free text, no identifiers, no app identities.
 */
export type PropertySpec = { kind: 'enum'; values: readonly string[] } | { kind: 'count'; max: number } | { kind: 'boolean' };

export const ANALYTICS_EVENTS = {
  onboarding_started: {},
  onboarding_completed: { step_count: { kind: 'count', max: 20 }, timer_enabled: { kind: 'boolean' } },
  permission_granted: { permission_type: { kind: 'enum', values: ['family_controls', 'usage_access', 'overlay', 'notifications'] } },
  permission_denied: { permission_type: { kind: 'enum', values: ['family_controls', 'usage_access', 'overlay', 'notifications'] } },
  ritual_started: { timer_enabled: { kind: 'boolean' } },
  scripture_completed: {},
  prayer_completed: {},
  ritual_completed: { step_count: { kind: 'count', max: 3 }, timer_enabled: { kind: 'boolean' }, offline: { kind: 'boolean' } },
  restriction_applied: { tier: { kind: 'enum', values: ['tier0', 'tier1', 'tier2'] } },
  restriction_removed: { reason: { kind: 'enum', values: ['ritual_completed', 'window_ended', 'emergency_bypass'] } },
  emergency_bypass_used: {},
  schedule_created: { kind: { kind: 'enum', values: ['morning', 'custom'] }, weekday_count: { kind: 'count', max: 7 } },
  premium_paywall_viewed: { source: { kind: 'enum', values: ['learning', 'tutor', 'settings', 'post_lesson'] } },
  subscription_started: { period: { kind: 'enum', values: ['monthly', 'annual'] }, is_trial: { kind: 'boolean' } },
  lesson_completed: { lesson_count: { kind: 'count', max: 1000 } },
  quiz_completed: { question_count: { kind: 'count', max: 10 }, score: { kind: 'count', max: 10 } },
} as const satisfies Record<string, Record<string, PropertySpec>>;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENTS;

type SpecValue<S> = S extends { kind: 'enum'; values: readonly (infer V)[] } ? V : S extends { kind: 'count' } ? number : S extends { kind: 'boolean' } ? boolean : never;
export type AnalyticsProps<E extends AnalyticsEventName> = { [K in keyof (typeof ANALYTICS_EVENTS)[E]]?: SpecValue<(typeof ANALYTICS_EVENTS)[E][K]> };

export type ValidationResult = { ok: true; props: Record<string, string | number | boolean> } | { ok: false; reason: string };

export function validateEvent(event: string, props: Record<string, unknown> = {}): ValidationResult {
  const spec = (ANALYTICS_EVENTS as Record<string, Record<string, PropertySpec>>)[event];
  if (!spec) return { ok: false, reason: `unknown event: ${event}` };
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    const p = spec[key];
    if (!p) return { ok: false, reason: `unknown property ${key} for ${event}` };
    if (p.kind === 'enum') {
      if (typeof value !== 'string' || !p.values.includes(value)) return { ok: false, reason: `invalid enum value for ${key}` };
    } else if (p.kind === 'count') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > p.max) return { ok: false, reason: `invalid count for ${key}` };
    } else if (typeof value !== 'boolean') {
      return { ok: false, reason: `invalid boolean for ${key}` };
    }
    out[key] = value as string | number | boolean;
  }
  return { ok: true, props: out };
}
