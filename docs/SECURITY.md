# Security

This document is the standard that the Milestone 10 review checks against.

## Principles

1. No secrets in the mobile app: no OpenAI key, no Supabase service role key, no RevenueCat secret key. Only the Supabase URL and anon key, the RevenueCat public SDK keys, the Sentry DSN and the PostHog project key ship in the app.
2. Authorization lives in the database (RLS) and in Edge Functions. The client is never trusted for entitlement, time, `local_date` or quota.
3. Selected application identities (iOS tokens, Android package names) never leave the device, never reach logs or analytics.
4. Prayer journals are private by default and stay out of analytics, logs, Sentry breadcrumbs and AI prompts.

## Controls

| Area | Control | Verification |
|------|---------|-------------|
| Tokens | Supabase session stored in Keychain and Keystore through a storage adapter. MMKV holds only non sensitive cache. | Unit test of the adapter, code review |
| RLS | RLS enabled on every user table with explicit select, insert, update and delete policies. Content tables are read only for authenticated users, writable by service role. `subscriptions` has no client write policy. | pgTAP: cross user read and write attempts fail for every table |
| Functions | JWT verification on every `/v1` function, Zod validation, per user rate limit, structured errors with request ids, no sensitive content in logs. The webhook checks the RevenueCat authorization header with constant time comparison. | Deno tests |
| Idempotency | Unique `idempotency_key` per user for ritual mutations and unique `event_id` for webhook events. | Replay tests |
| AI | Provider called only from Edge Functions. Input length cap, moderation, crisis detection, token budgets, kill switch, citation verification, injection tests. | Eval set, unit tests |
| Logging | A `logger` that accepts only an allow listed field set. Request bodies are never logged. | Unit test, lint rule |
| Sentry | `beforeSend` and `beforeBreadcrumb` strip request bodies, user text, app identities and journal fields. | Unit test with fixture events |
| Analytics | PostHog wrapper accepts only allow listed events and properties (enums, counts, booleans). Autocapture and session replay off. | Unit test fails the build on any unknown event or property |
| Account deletion | `POST /v1/account/delete` removes journals, tutor threads, sessions, preferences, subscription links and the auth user. | Integration test counts remaining rows |
| Dependencies | `pnpm audit` in CI, lockfile committed, Dependabot configuration. | CI |
| Secrets scan | CI runs a secrets scan (gitleaks) on every push. | CI |
| Transport | HTTPS only. iOS ATS default, Android `usesCleartextTraffic=false`. | Manifest check |

## Threats considered

- Cross user data access: mitigated by RLS and tests.
- Replay of ritual mutations: idempotency keys and unique constraints.
- Clock manipulation to complete early or duplicate: server time and monotonic duration.
- Premium bypass through a local flag: entitlement checked server side, client reads `GET /v1/subscription/status`.
- Prompt injection through retrieved content or user input: retrieved text is data in a delimited block, output is schema constrained, quotations are verified against stored text, tests included.
- Divine voice, prophecy and crisis handling: fixed system rules, classifier plus keyword backstop, tests.
- Abuse of AI budget: quotas, rate limits, kill switch.
- Webhook forgery: authorization secret check, idempotent by event id.

## Incident response

Rotate the affected key in the provider console, redeploy functions, revoke sessions if needed (Supabase Auth admin), record the event in `docs/` post mortem, and notify users if personal data was exposed as the law requires.
