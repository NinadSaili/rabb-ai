# Status

Last updated: 2026-11-13, session 2 (Android build, demo mode and safety fixes).

Labels: IMPLEMENTED (code and tests), MOCKED (external service replaced by a labelled mock behind an interface), BLOCKED (blocker stated), NOT_STARTED.

## Verification evidence (what has actually run)

| Check | Where | Result |
|-------|-------|--------|
| Lint, typecheck, unit tests (packages 207, mobile 119) | local and CI `node` job | pass |
| Real Supabase CLI: `db reset`, `db lint`, `test db` (254 pgTAP assertions, 8 files) | CI `database` job | pass |
| Deno function tests (45) and AI evals (40 prompts, mock provider) against Postgres with pgvector | CI `functions` job | pass |
| Gitleaks secrets scan | CI `secrets-scan` job | pass |
| Kotlin decision logic (22 JVM tests) | CI `android-logic` job | pass |
| Android release APK builds (Gradle 9.4, AGP 9, RN 0.88, Expo 58, NDK 27), Kotlin module `rabb-blocking` compiles | CI `android-apk` workflow, about 9 minutes | pass (arm64-v8a and x86_64, 40 MB) |
| APK manifest: has PACKAGE_USAGE_STATS, SYSTEM_ALERT_WINDOW, FOREGROUND_SERVICE_SPECIAL_USE, does not have QUERY_ALL_PACKAGES | CI APK inspection step | pass |
| Non-demo JS bundle contains no placeholder scripture and no demo API | `pnpm check:release-bundle`, CI | pass |
| Install, cold launch (about 1.7 s), JS and MMKV start on an Android 14 x86_64 emulator without a crash | CI `emulator-smoke` | pass |
| Demo journey on the emulator with Maestro: onboarding, apps, schedule, scripture, prayer, 30 s timer, completion, "Unlocked (simulated)" | CI `emulator-smoke`, run 43432243331, first attempt | pass (1 min 32 s) |
| Demo journey as a Jest UI test through the real navigator and screens | `apps/mobile/src/__tests__/demoJourney.test.tsx` | pass |

NOT verified: any physical device, real Usage Access or overlay behaviour, the foreground service, the block screen over a real app, reboot and process-death behaviour, OEM behaviour, iOS (no Mac). Native blocking is compiled but not tested. It must not be described as working.

## Environment

| Tool | Required | Found | Effect |
|------|----------|-------|--------|
| Node | 20 LTS | 22.23.4 | Pinned to 20 in `.nvmrc`. CI uses 20 (R10) |
| pnpm | 10 | 10.28.0 | fine |
| Deno | 2 | 2.9.6 (npm dev dependency) | fine |
| PostgreSQL 16 with pgvector 0.6.0 and pgTAP 1.3.2 | fallback DB | installed from apt | used by `scripts/db-local.sh` (R11) |
| Supabase CLI, Docker daemon | `supabase db reset`, `test db` | missing / daemon down | not run here. CI runs them |
| JDK 21, Gradle 8.14 | Kotlin logic tests | present | Kotlin JVM tests run |
| Android SDK, adb | Android build | missing (`dl.google.com` blocked) | Android build BLOCKED |
| Xcode, CocoaPods, Mac | iOS build | missing (Linux host) | iOS build BLOCKED |
| Physical devices | spikes | none | spikes BLOCKED |
| Primary licence sources (berean.bible, ebible.org) | licence verification | proxy 403 | licences UNVERIFIED |

## Capability matrix

| Capability | State | Notes |
|------------|-------|-------|
| Planning documents (14) | IMPLEMENTED | `docs/`. API spec generated from contracts |
| Monorepo, lint, typecheck, CI workflow | IMPLEMENTED | CI file written, not yet run on GitHub |
| Contracts (Zod) | IMPLEMENTED | 6 tests |
| Ritual engine (exhaustive state machine, timer validation) | IMPLEMENTED | 148 tests, every (state, event) pair |
| Schedule core (day boundary, recurrence, DST, overlap, next restriction, streaks) | IMPLEMENTED | 50 tests, NY, London, Lord Howe, Havana fixtures |
| Database schema, constraints, RLS on every table | IMPLEMENTED | 23 required plus 2 extra tables, 100 explicit policies |
| pgTAP (isolation, constraints, RPCs, premium gate, deletion, rate limit) | IMPLEMENTED | 245 assertions pass on the fallback runner. Supabase CLI run BLOCKED (no CLI or Docker) |
| Content layer: daily verse and prayer selection with fallback, cache, 7 day prefetch, attribution | IMPLEMENTED | SQL functions and client cache tested |
| Bundled public domain provider with verified metadata | BLOCKED | Licences unverified. Only DEV ONLY KJV fixtures exist |
| Edge Functions `/v1` (12 endpoints), idempotency, rate limits, error envelope | IMPLEMENTED | 42 Deno tests against a real database. Deployment bundling unverified (R18 family) |
| Account deletion | IMPLEMENTED | API plus tests count remaining rows |
| RevenueCat webhook (secret check, idempotent, ordered, only writer) | IMPLEMENTED | 3 tests. Live sandbox BLOCKED (RevenueCat project and keys) |
| Paywall and purchase client | BLOCKED | Needs RevenueCat keys and a device. Screen typechecks, untested. Billing is not activated |
| Learning paths, lessons, quiz (cached approved questions, server entitlement gate) | IMPLEMENTED | Server and RLS tested. Draft question generation script NOT_STARTED |
| AI tutor pipeline (kill switch, entitlement, quota, crisis, divine voice, moderation, retrieval, verification, ledger, streaming) | IMPLEMENTED | Tests and 40 prompt eval set run on the MOCK provider |
| AI provider for live OpenAI | BLOCKED | No API key. Code complete, never run live (R22) |
| Ingestion into pgvector | IMPLEMENTED | Tested with the mock provider. No approved corpus yet (R26) |
| Analytics allow list and PostHog wrapper | IMPLEMENTED | Tests, including a source scan for event names |
| Sentry scrubbing | IMPLEMENTED | Fixture tests. Live DSN BLOCKED |
| Mutation queue, API client, ritual sender, offline daily load | IMPLEMENTED | Jest |
| Ritual controller (unlock states from native read back, rollover) | IMPLEMENTED | 14 tests |
| Emergency bypass logic (5 s hold, confirm, no network, local log) | IMPLEMENTED | 4 tests. Hold UI untested |
| Auth: anonymous start, email linking, sign in | IMPLEMENTED | Tested against a fake client |
| Auth: Apple and Google | BLOCKED | Provider credentials and live testing (R21) |
| Theme tokens, contrast AA both modes, fonts | IMPLEMENTED | 22 contrast tests, OFL fonts bundled |
| Component library (11 components, screen reader labels) | IMPLEMENTED | RNTL tests |
| Screens and navigation on the demo journey (splash, onboarding, app selection, schedule, home, scripture, prayer, timer, completion) | IMPLEMENTED | Jest UI test plus Maestro on an Android 14 emulator in CI. Demo mode only: simulated restrictions, local API |
| Remaining screens (habits, schedules list, reader, learning, tutor, paywall, account link, settings, privacy and bypass hold UI) | BLOCKED | Typechecked, not UI tested. Hold-to-bypass needs a device test |
| Demo mode (local API, simulated restrictions, banner on every screen, reset) | IMPLEMENTED | Labelled DEMO everywhere, excluded from non-demo bundles by a build-time check. Not real enforcement |
| Notifications: planner | IMPLEMENTED | 6 tests. Notifee adapter written, device untested |
| Android blocking: decision logic and tier resolver | IMPLEMENTED | 22 JVM tests pass |
| Android blocking: service, block screen, store, boot, module | BLOCKED | Compiles and packages in CI (`:rabb-blocking:compileReleaseKotlin`). Never run against a real app on a device, so blocking behaviour is untested |
| iOS Screen Time: module, extensions, shared state | BLOCKED | Written, not compiled. Extension targets not in the Xcode project (no Xcode) |
| iOS spike and Android spike | BLOCKED | Protocols with expected results are in the platform docs. No results recorded |
| Accessibility audit on devices, performance budget | BLOCKED | Needs devices |
| Release readiness items (privacy manifest file, store forms, TestFlight and Play tracks) | NOT_STARTED | Checklist drafted. The template `PrivacyInfo.xcprivacy` exists but has not been reviewed against the SDKs in use (MMKV, Sentry, PostHog, Notifee, RevenueCat). Owner accounts needed |

## Open blockers

1. A physical Android phone to install the APK on, then spikes A1 to A11 (`docs/ANDROID_BLOCKING.md`) on a Pixel and a Samsung or Xiaomi. Until then native blocking is untested.
2. A hosted Supabase project and credentials, to run the non-demo build against a real backend. Not needed for the demonstration.
3. Apple Family Controls entitlement and a Mac for iOS (R1).
4. Licence verification of BSB, WEB and KJV from primary sources. Demo placeholder text is KJV and is not licensed for release (R28).
5. Credentials not yet used: OpenAI, RevenueCat, Sentry, PostHog, Apple and Google sign in. Live AI and billing are deliberately not active.
6. Owner decisions: midnight unlock wording (R17), release signing key for a store build (the APK is debug signed).

## Next

1. Install the demo APK on a phone, rehearse `docs/DEMO_GUIDE.md` end to end, and note anything that looks wrong on a real screen (font scale, dark mode, small phones).
2. Run the Android spikes on real devices with a non-demo build, with Usage Access and overlay granted. Record results in `docs/ANDROID_BLOCKING.md`.
3. Review the extra manifest permissions pulled in by libraries (biometric, storage up to API 32) before any store submission (R31).

## Commands to resume

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm check:release-bundle
pnpm db:reset && pnpm db:test
pnpm functions:test && pnpm ai:evals
pnpm --filter @rabb/mobile android:logic-test
```
APK: GitHub Actions `android-apk` (see `docs/ANDROID_BUILD.md`). Emulator test: `android-smoke`.
