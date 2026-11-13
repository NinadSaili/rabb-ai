# Scripture licensing

Rule: no Bible text ships without verified commercial distribution and AI usage rights. Verification means reading the licence or public domain statement on the primary source and recording it here with date and reviewer. Secondary sources do not count.

## Verification status

The authoring environment cannot reach the primary sources (outbound requests to the publisher sites return proxy 403 on 2026-11-13). Every row below is therefore UNVERIFIED. Nothing in this table may be treated as cleared until a person fills the verified columns.

| Translation | Code | Claimed status (to be confirmed) | Primary source to check | Commercial use | AI use | Verified by | Verified on | State |
|-------------|------|----------------------------------|-------------------------|----------------|--------|-------------|-------------|-------|
| Berean Standard Bible | BSB | Dedicated to the public domain by its publisher | berean.bible (terms page) | pending | pending | | | UNVERIFIED |
| World English Bible | WEB | Described as public domain by its maintainers | ebible.org and worldenglish.bible | pending | pending | | | UNVERIFIED |
| King James Version | KJV | Public domain in the United States. The Crown holds letters patent in the United Kingdom. | A primary publisher statement, plus Cambridge University Press guidance for UK distribution | pending | pending | | | UNVERIFIED |

## Release gate

A release build fails if any translation in `scripture_translations` with `include_in_release = true` lacks a `license_verified_at` value. Seed fixtures carry `is_dev_only = true` and are excluded from release by the seed script and the gate.

## Stored metadata per translation

`code`, `name`, `language`, `license_name`, `license_url`, `copyright_text`, `attribution_text`, `is_public_domain`, `commercial_use_verified`, `ai_use_verified`, `license_verified_at`, `include_in_release`, `is_dev_only`. The reader renders `attribution_text` under every passage.

## Developer fixtures

`supabase/seed` contains a handful of short passages labelled DEV ONLY, unlicensed. They exist so screens and tests run. They are excluded from release builds. No text is scraped from YouVersion or any Bible app.

## Procedure to add a translation

1. Identify the primary source and read its licence text.
2. Record the quote of the grant, URL, date and reviewer in the table.
3. Confirm commercial use and AI (retrieval and generation context) use in writing where the grant is not explicit.
4. Import with `scripts/import-translation.ts` (planned), which refuses to run without the verified fields.
5. Verify the reader displays attribution.
