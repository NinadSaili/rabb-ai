# Privacy

Rabb.ai collects the minimum needed to run a daily Bible habit.

## Data inventory

| Data | Where | Purpose | Leaves device |
|------|-------|---------|---------------|
| Selected apps (iOS tokens, Android package names) | App Group container (iOS), encrypted DataStore (Android) | Restrict those apps | Never |
| Auth identity (anonymous id, email, Apple or Google id) | Supabase Auth | Account | Yes, to Supabase |
| Profile: timezone, language, translation | Postgres | Day boundary, content | Yes |
| Schedules | Postgres | Sync across reinstall | Yes |
| Ritual sessions and steps | Postgres | Habit tracking, streaks | Yes |
| Prayer journal | Postgres, owner only | User's private notes | Yes, encrypted at rest by provider. Never in analytics, logs or Sentry. Never in AI prompts unless the entry has `ai_opt_in` true. |
| Tutor threads | Postgres | Conversation history | Yes. Deleted with account. |
| AI usage ledger | Postgres | Quota | Counts and token totals only, no content |
| Subscription status | Postgres via RevenueCat webhook | Entitlement | Yes |
| Analytics events | PostHog | Product metrics | Allow listed enums, counts and booleans only |
| Crash reports | Sentry | Stability | Scrubbed |
| Emergency bypass log | Device only | User's own record | Never |

## What is never collected

Prayer text, tutor questions, journal content, app identities and free text in analytics. Advertising identifiers. No ads in v1.

## Analytics allow list

Events: onboarding_started, onboarding_completed, permission_granted, permission_denied, ritual_started, scripture_completed, prayer_completed, ritual_completed, restriction_applied, restriction_removed, emergency_bypass_used, schedule_created, premium_paywall_viewed, subscription_started, lesson_completed, quiz_completed. Properties: enums, counts and booleans only. Enforced in code (`apps/mobile/src/services/analytics`) and by a failing test.

## User rights

Account deletion is in the app (Settings, Privacy). It removes all user data including journals, tutor threads and subscription links. Export is not in v1 and is listed as a known limitation.

## Age

13 and over. The onboarding age gate records only a boolean confirmation locally and in `profiles.age_confirmed`.

## Third parties

Supabase (hosting, auth), RevenueCat (subscriptions), OpenAI (tutor, server side only, no journal content without opt in), PostHog (events), Sentry (errors). Each is listed in the store privacy disclosures (`RELEASE_CHECKLIST.md`).

## Apple and Google disclosures

Privacy manifest, App Privacy labels and Play Data safety answers are drafted in `RELEASE_CHECKLIST.md`. Family Controls tokens are opaque, stay on device and are not "collected" under Apple's definition because they never leave the device. Confirm wording with Apple review notes.
