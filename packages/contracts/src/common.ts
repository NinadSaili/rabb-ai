import { z } from 'zod';

export const uuid = z.string().uuid();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
export const isoTimestamp = z.string().datetime({ offset: true });
export const ianaTimezone = z.string().min(1).max(64).regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/, 'IANA timezone name');
export const idempotencyKey = uuid;

/** Diagnostic only. The server never reads this for logic. */
export const clientTimestamp = isoTimestamp.optional();

export const scriptureReference = z.object({
  /** USFM book code, for example JHN. */
  book: z.string().regex(/^[1-3A-Z]{3}$/),
  chapter: z.number().int().min(1).max(150),
  verse_start: z.number().int().min(1).max(176),
  verse_end: z.number().int().min(1).max(176).optional(),
});
export type ScriptureReference = z.infer<typeof scriptureReference>;

export const translationMeta = z.object({
  code: z.string().min(2).max(12),
  name: z.string(),
  language: z.string().min(2).max(8),
  license_name: z.string(),
  copyright_text: z.string(),
  attribution_text: z.string(),
});
export type TranslationMeta = z.infer<typeof translationMeta>;

export const ERROR_CODES = [
  'unauthenticated',
  'forbidden',
  'validation_failed',
  'not_found',
  'conflict',
  'idempotency_key_reuse',
  'rate_limited',
  'quota_exceeded',
  'premium_required',
  'feature_disabled',
  'timer_invalid',
  'illegal_transition',
  'internal',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const apiError = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    request_id: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiError>;
