# Admin

No application in v1. The editorial workflow runs through Supabase Studio and SQL.

## Publishing a daily verse or prayer

1. Insert a row in `daily_verses` or `daily_prayers` with `status = 'draft'`, a `publish_date`, `language`, and `theme`.
2. A second person reviews it. Set `status = 'in_review'`, then `approved` with `reviewed_by` and `reviewed_at`. The database refuses `approved` and `published` without both fields.
3. Set `status = 'published'`. Only one published row per date and language is allowed.
4. Fallback entries (`is_fallback = true`, `status = 'approved'`, unique `fallback_rank` per language) are used when no published entry exists for a date. They rotate deterministically by date.

## Quiz and lesson content

Same states. Clients only receive `published` rows, and the quiz endpoint serves only `published` questions, so no model call happens at quiz time.

## Translations

Add a row to `scripture_translations` only after the licence is verified from the primary source and recorded in `docs/SCRIPTURE_LICENSING.md`. `include_in_release` stays false until `license_verified_at`, `commercial_use_verified` and `ai_use_verified` are set. The database enforces this.

## Feature flags

`ai_tutor_enabled` is the global kill switch for the tutor. `android_tier1_enabled` and `android_accessibility_enabled` default to false.
