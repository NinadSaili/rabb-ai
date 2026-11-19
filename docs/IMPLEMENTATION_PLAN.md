# Implementation plan

Status of each capability lives in `STATUS.md`. Risks live in `RISK_REGISTER.md`. This file defines order of work, task breakdowns and exit criteria.

## Build principles

1. Vertical slices. Every slice compiles, is typed, linted and tested before the next starts.
2. Pure logic first. `ritual-engine`, `schedule-core` and `contracts` are plain TypeScript with no IO, so they are fully testable on any machine, including CI without devices.
3. Native risk first. Milestone 0b (spikes) runs before feature screens. Where a spike cannot run in the current environment, the work is recorded as BLOCKED with the exact test protocol so a person with a device can run it.
4. Honest capability labels: IMPLEMENTED, MOCKED, BLOCKED, NOT_STARTED, nothing else.

## Milestone 0: inspect and plan

Tasks
1. Inventory toolchains and record gaps (see `STATUS.md`, section Environment).
2. Write the 14 planning documents.
3. Write exact init, build and run commands (`README.md`).
4. Initialize monorepo skeleton (pnpm workspace, TS strict base config).

Exit criteria: documents committed, environment gaps recorded, risk register seeded.

## Milestone 0b: native spikes (time boxed, 2 days each)

iOS spike tasks: FamilyActivityPicker, authorization (individual), shield apply and remove through ManagedSettingsStore, DeviceActivity interval start and end callbacks, App Group state, shield configuration text, entitlement-missing behaviour. Physical device only.

Android spike tasks: Usage Access flow, foreground service foreground-app detection, block activity over a selected app with overlay permission, process death, reboot, battery saver, on one Pixel and one Samsung or Xiaomi.

Exit criteria: findings written into `IOS_SCREEN_TIME.md` and `ANDROID_BLOCKING.md`, the ritual rules in `PRODUCT_REQUIREMENTS.md` confirmed or amended, risk register updated.

Environment note: Xcode, an Android SDK and physical devices are not available in the authoring environment. Spike results are therefore NOT recorded as verified. The protocols, expected results and result tables are in the platform documents, and the spike harness code ships as the native modules in Milestones 4 and 5. Rules that depend on spike results are marked UNVERIFIED_ON_DEVICE.

## Milestone 1: foundation, design system, navigation, auth

Tasks: monorepo and CI; `.env.example`; theme tokens and fonts; component library with screen reader labels; typed React Navigation; Supabase client with Keychain and Keystore storage adapter; anonymous session bootstrap; email, Apple and Google sign in; account linking; settings shell; error boundary; Sentry with scrubbing; PostHog wrapper with allow list.

Exit: `pnpm lint`, `pnpm typecheck`, `pnpm test` green; component tests for accessibility labels; contrast test for both themes; analytics allow list test.

## Milestone 2: database, RLS, content services

Tasks: migrations for all required and additional tables; triggers; RLS policies; pgTAP tests per table; `ScriptureProvider` and local public domain provider; offline cache with 7 day prefetch; deterministic daily verse selection with approved fallback list; DEV ONLY seed.

Exit: migrations apply on a clean database; every user table has explicit select, insert, update and delete policies; pgTAP isolation tests pass.

## Milestone 3: ritual engine and daily flow

Tasks: reducer with exhaustive state type; legal and illegal transition tests; day boundary and timer validation in `schedule-core` and server; persistent mutation queue with idempotency keys; screens 7 to 11 wired to real state; emergency bypass flow.

Exit: engine tests cover every transition pair; server tests prove duplicate completion prevention and clock-change immunity; screens render from real store state.

## Milestone 4: iOS Screen Time

Tasks: four targets and App Group; `AppBlockingService` Swift module; `SelectedAppsSummaryView`; failure paths; documentation.

Exit: Swift sources reviewed and compile-ready; device test checklist complete. Compile and device verification are BLOCKED until a Mac with Xcode and an Apple approved entitlement are available.

## Milestone 5: Android blocking

Tasks: Kotlin `AppBlockingService`; Usage Access and overlay flows; foreground service; block activity; boot receiver; encrypted DataStore for selection; capability tiers and feature flags; status screen; OEM guidance.

Exit: pure Kotlin decision logic has JVM unit tests; Gradle build and device tests BLOCKED until an Android SDK and device are available.

## Milestone 6: schedules, notifications, habits

Tasks: weekly recurrence, overlap resolution, DST, timezone travel, next restriction time in `schedule-core`; Notifee reminders with permission education; streak logic with one grace day per week; calendar and weekly view.

Exit: all calculations unit tested including DST fixtures for America/New_York, Europe/London, Australia/Lord_Howe, and a zone that changes at midnight.

## Milestone 7: premium learning and quizzes

Tasks: tables and seed content; entitlement gate in Edge Functions; paywall client states; quiz cache from approved questions only.

Exit: free user receives 403 `premium_required` from learning endpoints; premium user receives content; tests cover both.

## Milestone 8: AI tutor with RAG

Tasks: provider interface; ingestion script; pipeline (auth, entitlement, quota, moderation, retrieve, generate, verify, return); crisis fixed response; budgets and kill switch; streaming; 40 prompt eval set.

Exit: citation verifier unit tests; injection tests; eval harness runs against a mock provider in CI and against the real provider on demand; no response path returns an unverified quotation.

## Milestone 9: RevenueCat

Tasks: webhook with authorization secret check and event ID idempotency; service role writer; client reads server status; paywall states; sandbox testing docs.

Exit: webhook signature and replay tests pass; client never reads a local premium flag.

## Milestone 10: QA, security, release

Tasks: full suites; accessibility audit checklist; performance budget; security review against `SECURITY.md`; store readiness; physical device checklist; beta plan.

Exit: `RELEASE_CHECKLIST.md` complete with each item marked done, blocked or owner-pending.

## Commands run after every milestone

```
pnpm lint && pnpm typecheck && pnpm test
pnpm db:reset && pnpm db:test      # supabase db reset, supabase test db (or local Postgres fallback)
pnpm functions:test                # deno test
```
