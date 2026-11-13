# Status

Last updated: 2026-11-13, end of session 1 (Milestones 0 to 10 built as far as this environment allows).

Labels: IMPLEMENTED (code and tests), MOCKED (external service replaced by a labelled mock behind an interface), BLOCKED (blocker stated), NOT_STARTED.

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
| Paywall and purchase client | BLOCKED | Needs RevenueCat keys and a device. Screen typechecks, untested |
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
| Screens 1 to 22, navigation | BLOCKED | Typechecked only. No simulator or device to render or run E2E (Maestro flows NOT_STARTED) |
| Notifications: planner | IMPLEMENTED | 6 tests. Notifee adapter written, device untested |
| Android blocking: decision logic and tier resolver | IMPLEMENTED | 22 JVM tests pass |
| Android blocking: service, block screen, store, boot, module | BLOCKED | Written, not compiled (no Android SDK) |
| iOS Screen Time: module, extensions, shared state | BLOCKED | Written, not compiled. Extension targets not in the Xcode project (no Xcode) |
| iOS spike and Android spike | BLOCKED | Protocols with expected results are in the platform docs. No results recorded |
| Accessibility audit on devices, performance budget | BLOCKED | Needs devices |
| Release readiness items (privacy manifest file, store forms, TestFlight and Play tracks) | NOT_STARTED | Checklist drafted. The template `PrivacyInfo.xcprivacy` exists but has not been reviewed against the SDKs in use (MMKV, Sentry, PostHog, Notifee, RevenueCat). Owner accounts needed |

## Open blockers

1. Apple Family Controls entitlement request for four bundle IDs (owner action, R1).
2. Mac with Xcode and an iPhone: create the extension targets, build, run spikes S1 to S13.
3. Android SDK and a Pixel plus a Samsung or Xiaomi device: build, run spikes A1 to A11.
4. Licence verification of BSB, WEB and KJV from primary sources, then a licensed provider and corpus.
5. Credentials: Supabase project, OpenAI key and model names, RevenueCat project and keys, Sentry DSN, PostHog key, Apple and Google sign in.
6. Owner decisions: R17 (midnight unlock wording), Android accessibility flavor (stays off without approval).

## Next (first three tasks)

1. On a Mac: `pod install`, create the three extension targets per `docs/IOS_SCREEN_TIME.md`, build to a device, run spikes S1 to S13 and record results. Amend `PRODUCT_REQUIREMENTS.md` and the risk register for anything that fails.
2. With Android Studio: build, run spikes A1 to A11 on two devices, fix compile errors in the Kotlin module, then run through the screens and add Maestro flows for onboarding and the ritual.
3. Run `pnpm ai:evals` with `AI_PROVIDER=openai`, verify licences, approve a corpus, run `pnpm ai:ingest`.

## Commands to resume

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm db:reset && pnpm db:test
pnpm functions:test && pnpm ai:evals
pnpm --filter @rabb/mobile android:logic-test
```
