# Status

Last updated: 2026-11-13, session 1 (Milestone 0).

Labels: IMPLEMENTED, MOCKED, BLOCKED (blocker stated), NOT_STARTED.

## Environment

| Tool | Required | Found | Gap |
|------|----------|-------|-----|
| Node | 20 LTS | 22.23.4 | Version differs, pinned in `.nvmrc`, CI uses 20 (R10) |
| pnpm | yes | 10.28.0 | none |
| TypeScript | strict | via devDependency | none |
| Xcode, xcrun | iOS build | missing (Linux host) | iOS compile and device tests BLOCKED |
| CocoaPods | iOS | missing | `pod install` BLOCKED |
| Android SDK, adb, sdkmanager | Android build | missing, `dl.google.com` is not reachable | Gradle build and device tests BLOCKED |
| JDK | 17 or 21 | OpenJDK 21 | none |
| Supabase CLI | db reset, test db | missing, GitHub release download returns 403 | Fallback `scripts/db-local.sh` (R11) |
| Docker daemon | Supabase local stack | CLI present, daemon not running | same |
| Deno | function tests | installed via npm package `deno` 2.9.6 | none (install with `pnpm` dev dependency) |
| PostgreSQL 16 | fallback DB | installed, pgvector 0.6.0 and pgTAP 1.3.2 installed from apt | none |
| Physical iOS and Android devices | spikes | none | Spikes BLOCKED |

## Capability matrix

| Capability | State | Notes |
|------------|-------|-------|
| Planning documents | IMPLEMENTED | docs/ |
| Monorepo and CI | NOT_STARTED | |
| Theme, components, navigation | NOT_STARTED | |
| Auth (anonymous, email, Apple, Google) | NOT_STARTED | |
| Database, RLS, pgTAP | NOT_STARTED | |
| Content layer and offline cache | NOT_STARTED | |
| Ritual engine | NOT_STARTED | |
| Schedule core and streaks | NOT_STARTED | |
| Edge Functions /v1 | NOT_STARTED | |
| iOS Screen Time native | BLOCKED | No Mac, Xcode, device or Apple entitlement |
| Android blocking native | BLOCKED | No Android SDK or device |
| Notifications | NOT_STARTED | |
| Learning and quizzes | NOT_STARTED | |
| AI tutor and evals | NOT_STARTED | OpenAI key needed for real provider runs, mock provider planned |
| RevenueCat | NOT_STARTED | RevenueCat project and keys needed for sandbox runs |
| Release readiness | NOT_STARTED | |
| iOS spike | BLOCKED | Device and entitlement |
| Android spike | BLOCKED | Device and SDK |

## Open blockers

1. Apple Family Controls entitlement request (owner action, R1).
2. Mac with Xcode and a physical iPhone for the iOS spike.
3. Android SDK and one Pixel plus one Samsung or Xiaomi device.
4. Primary source verification of BSB, WEB and KJV licences (`SCRIPTURE_LICENSING.md`).
5. Credentials needed later: Supabase project, OpenAI key, RevenueCat keys, Sentry DSN, PostHog key.

## Next

Initialize the monorepo, build the pure TypeScript packages, then database migrations and pgTAP.

## Commands to resume

```
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```
