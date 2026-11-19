import * as fs from 'fs';
import * as path from 'path';
import { ANALYTICS_EVENTS, validateEvent } from './allowlist';
import { Analytics } from './analytics';

const REQUIRED_EVENTS = [
  'onboarding_started', 'onboarding_completed', 'permission_granted', 'permission_denied', 'ritual_started', 'scripture_completed',
  'prayer_completed', 'ritual_completed', 'restriction_applied', 'restriction_removed', 'emergency_bypass_used', 'schedule_created',
  'premium_paywall_viewed', 'subscription_started', 'lesson_completed', 'quiz_completed',
];

describe('analytics allow list', () => {
  it('contains exactly the specified events', () => {
    expect(Object.keys(ANALYTICS_EVENTS).sort()).toEqual([...REQUIRED_EVENTS].sort());
  });

  it('rejects unknown events', () => {
    expect(validateEvent('prayer_text_viewed', {}).ok).toBe(false);
  });

  it('rejects unknown properties', () => {
    expect(validateEvent('ritual_started', { user_email: 'a@b.c' }).ok).toBe(false);
    expect(validateEvent('permission_granted', { package_name: 'com.example' }).ok).toBe(false);
  });

  it('rejects free text, identifiers and wrong types', () => {
    expect(validateEvent('permission_granted', { permission_type: 'com.instagram.android' }).ok).toBe(false);
    expect(validateEvent('permission_granted', { permission_type: 'a free text prayer' }).ok).toBe(false);
    expect(validateEvent('ritual_completed', { step_count: 'three' }).ok).toBe(false);
    expect(validateEvent('ritual_completed', { step_count: 2.5 }).ok).toBe(false);
    expect(validateEvent('ritual_completed', { step_count: 99 }).ok).toBe(false);
    expect(validateEvent('ritual_started', { timer_enabled: 'yes' }).ok).toBe(false);
  });

  it('accepts enums, counts and booleans', () => {
    expect(validateEvent('ritual_completed', { step_count: 3, timer_enabled: true, offline: false }).ok).toBe(true);
    expect(validateEvent('permission_denied', { permission_type: 'usage_access' }).ok).toBe(true);
  });

  it('every property spec is an enum, count or boolean', () => {
    for (const props of Object.values(ANALYTICS_EVENTS)) {
      for (const spec of Object.values(props as Record<string, { kind: string }>)) expect(['enum', 'count', 'boolean']).toContain(spec.kind);
    }
  });

  it('drops rejected events from the sink and throws in strict mode', () => {
    const sent: string[] = [];
    const lenient = new Analytics({ capture: (e) => sent.push(e) }, false);
    expect(lenient.track('ritual_started', { timer_enabled: true })).toBe(true);
    expect(lenient.track('ritual_started', { bogus: 1 } as never)).toBe(false);
    expect(sent).toEqual(['ritual_started']);
    expect(() => new Analytics(null, true).track('ritual_started', { bogus: 1 } as never)).toThrow();
  });

  it('every analytics.track call in the source uses an allow listed event', () => {
    const root = path.join(__dirname, '..', '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f.name) && !/\.test\./.test(f.name)) files.push(p);
      }
    };
    walk(root);
    const found: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/analytics\.track\(\s*['"]([A-Za-z0-9_]+)['"]/g)) found.push(m[1] as string);
      for (const m of src.matchAll(/analytics\.track\(\s*(?!['"])([^,)\s]+)/g)) throw new Error(`non literal analytics event in ${file}: ${m[1]}`);
    }
    for (const e of found) expect(REQUIRED_EVENTS).toContain(e);
  });
});
