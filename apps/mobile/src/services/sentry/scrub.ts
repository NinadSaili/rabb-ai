/**
 * Sentry data scrubbing. Removes anything that could carry prayer text, journal content, tutor questions,
 * selected application identities, credentials or contact details before an event leaves the device.
 */
const SENSITIVE_KEY = /(journal|prayer|message|question|answer|body|text|content|package|bundle|app_?id|app_?identit|token|password|secret|authorization|cookie|email|phone|name|ip_address|apikey|api_key)/i;
const REDACTED = '[redacted]';
const PACKAGE_LIKE = /\b[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}\b/gi;

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > 6) return REDACTED;
  if (typeof value === 'string') return value.replace(PACKAGE_LIKE, '[package]');
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : scrubValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

export interface SentryLikeEvent {
  user?: Record<string, unknown>;
  request?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  message?: string;
  exception?: { values?: { value?: string; type?: string }[] };
  breadcrumbs?: { category?: string; message?: string; data?: Record<string, unknown> }[];
}

export function scrubEvent<T extends SentryLikeEvent>(event: T): T {
  const e = { ...event } as SentryLikeEvent;
  delete e.user; // no user identity at all, including anonymous ids
  delete e.request; // no URLs with query strings, bodies, headers or cookies
  if (e.extra) e.extra = scrubValue(e.extra, 0) as Record<string, unknown>;
  if (e.contexts) e.contexts = scrubValue(e.contexts, 0) as Record<string, unknown>;
  if (e.tags) e.tags = scrubValue(e.tags, 0) as Record<string, unknown>;
  if (typeof e.message === 'string') e.message = scrubValue(e.message, 0) as string;
  if (e.exception?.values) {
    e.exception = { values: e.exception.values.map((v) => ({ ...v, value: typeof v.value === 'string' ? (scrubValue(v.value, 0) as string) : v.value })) };
  }
  if (e.breadcrumbs) e.breadcrumbs = e.breadcrumbs.map((b) => scrubBreadcrumb(b)).filter((b): b is NonNullable<typeof b> => b !== null);
  return e as T;
}

const DROP_CATEGORIES = new Set(['xhr', 'fetch', 'http', 'ui.input', 'navigation.params']);

export function scrubBreadcrumb<T extends { category?: string; message?: string; data?: Record<string, unknown> }>(b: T): T | null {
  if (b.category && DROP_CATEGORIES.has(b.category)) return null;
  const out = { ...b };
  if (typeof out.message === 'string') out.message = scrubValue(out.message, 0) as string;
  if (out.data) out.data = scrubValue(out.data, 0) as Record<string, unknown>;
  return out;
}
