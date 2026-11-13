# Architecture

## System context

```mermaid
flowchart LR
  User((User)) --> App[Rabb.ai mobile app<br/>React Native bare, New Architecture, Hermes]
  App -->|JWT, Zod validated JSON| Edge[Supabase Edge Functions /v1<br/>Deno]
  App -->|auth| Auth[Supabase Auth]
  App -->|purchase| RC[RevenueCat SDK]
  Edge --> PG[(Postgres + RLS + pgvector)]
  Edge -->|only here| OAI[OpenAI via provider interface]
  RC -->|webhook| Hook[revenuecat-webhook function]
  Hook -->|service role| PG
  App -->|allow listed events| PH[PostHog]
  App -->|scrubbed errors| Sentry[Sentry]
  App <-->|native module| OS[OS blocking layer<br/>iOS Screen Time / Android service]
```

## Monorepo

```
apps/mobile            React Native app, ios/ and android/ committed
apps/admin             README only
packages/ritual-engine pure reducer, no React, no IO
packages/schedule-core day boundary, recurrence, DST, next restriction, streaks
packages/contracts     Zod schemas and types shared by app and Edge Functions
supabase/              migrations, functions, tests (pgTAP), seed
```

Dependency direction: `apps/mobile` and `supabase/functions` depend on `contracts`, `ritual-engine`, `schedule-core`. The packages depend on nothing but `zod` (contracts only). Edge Functions import packages through a Deno import map pointing at the workspace sources.

## Ritual state machine

```mermaid
stateDiagram-v2
  [*] --> IDLE
  IDLE --> RITUAL_STARTED: START
  RITUAL_STARTED --> SCRIPTURE_COMPLETED: COMPLETE_SCRIPTURE
  SCRIPTURE_COMPLETED --> PRAYER_COMPLETED: COMPLETE_PRAYER
  PRAYER_COMPLETED --> TIMER_COMPLETED: COMPLETE_TIMER (timer configured)
  PRAYER_COMPLETED --> RITUAL_COMPLETED: FINISH (no timer)
  TIMER_COMPLETED --> RITUAL_COMPLETED: FINISH
  RITUAL_COMPLETED --> UNLOCK_REQUESTED: REQUEST_UNLOCK
  UNLOCK_REQUESTED --> UNLOCKED: UNLOCK_CONFIRMED
  UNLOCK_REQUESTED --> UNLOCK_FAILED: UNLOCK_FAILED
  UNLOCK_FAILED --> UNLOCK_REQUESTED: RETRY_UNLOCK
  RITUAL_STARTED --> ABANDONED: ABANDON
  SCRIPTURE_COMPLETED --> ABANDONED: ABANDON
  PRAYER_COMPLETED --> ABANDONED: ABANDON
  TIMER_COMPLETED --> ABANDONED: ABANDON
  RITUAL_STARTED --> EXPIRED: DAY_ROLLED_OVER
  SCRIPTURE_COMPLETED --> EXPIRED: DAY_ROLLED_OVER
  PRAYER_COMPLETED --> EXPIRED: DAY_ROLLED_OVER
  TIMER_COMPLETED --> EXPIRED: DAY_ROLLED_OVER
  UNLOCKED --> [*]
```

Order decision: scripture first, then prayer. Prayer before scripture is an illegal transition and is tested. Reason: the product promise is "read the verse, complete the prayer", and the prayer screen references the day's verse.

## Completion data flow

```mermaid
sequenceDiagram
  participant UI as Ritual screens
  participant Q as Persistent mutation queue (MMKV)
  participant API as POST /v1/ritual/*
  participant DB as Postgres
  participant OS as Native blocking module
  UI->>Q: enqueue step (idempotency key, monotonic duration)
  Q->>API: send when online
  API->>DB: insert ritual_steps (unique idempotency_key, session_id+step_type)
  DB-->>API: original row on retry
  API-->>Q: server local_date, status
  UI->>OS: removeRestrictions (local, independent of sync)
  OS-->>UI: read back native status
  UI->>UI: show Unlocked (verified), Unlock failed, or Unlocked locally, sync pending
```

The unlock never waits for the network. The UI state after unlock is derived from the native status read-back plus the queue length.

## iOS blocking

```mermaid
flowchart TB
  subgraph RabbApp
    JS[JS via Expo Modules API] --> Mod[RabbBlocking Swift module]
    Mod --> AC[AuthorizationCenter .individual]
    Mod --> Pick[FamilyActivityPicker host view]
    Mod --> MS[ManagedSettingsStore]
    Mod --> DAC[DeviceActivityCenter]
    View[SelectedAppsSummaryView<br/>SwiftUI Label token]
  end
  AG[(App Group container<br/>small Codable state)]
  Mod <--> AG
  subgraph Extensions
    Mon[ScreenTimeMonitor<br/>DeviceActivityMonitor] --> AG
    Shield[ShieldConfiguration] --> AG
    Act[ShieldAction] --> AG
  end
  DAC -->|interval start/end| Mon
  Mon --> MS
```

Selection tokens are written to the App Group only. No token and no count of any identity leaves the device. JS receives `{count, categoryCount, webDomainCount}`.

## Android blocking

```mermaid
flowchart TB
  JS[JS via Expo Modules API] --> K[RabbBlocking Kotlin module]
  K --> Store[(Encrypted DataStore<br/>selected package names)]
  K --> Perm[Permission flows with prominent disclosure]
  K --> FS[ForegroundService: foreground app detection<br/>UsageStatsManager polling]
  FS --> Block[BlockActivity shown over app<br/>needs overlay permission]
  Boot[BootReceiver] --> FS
  WM[WorkManager watchdog] --> FS
  K --> Tier[Capability tier resolver<br/>Tier 0 reminders, Tier 1 detect and block screen, Tier 2 accessibility flagged off]
```

Tier 2 lives in a separate build flavor, `accessibility`, and is not part of the default `play` flavor.

## AI tutor pipeline

```mermaid
flowchart LR
  A[JWT auth] --> B[Entitlement + kill switch]
  B --> C[Quota and rate limit]
  C --> D[Crisis detector]
  D -->|crisis| F1[Fixed compassionate message]
  D --> E[Moderation]
  E --> G[Embed query, pgvector retrieve]
  G -->|nothing relevant| F2[Says it found nothing]
  G --> H[Generate: strict JSON blocks]
  H --> I[Verify each scripture block vs stored text]
  I --> J[Drop or repair mismatches, check references]
  J --> K[Stream blocks to client]
  K --> L[Write ai_usage_ledger: counts only]
```

Retrieval never includes `prayer_journal` rows unless that entry has `ai_opt_in = true`.

## Data model summary

Core tables: `profiles`, `user_preferences`, `ritual_schedules`, `ritual_sessions`, `ritual_steps`, `user_streaks`, `prayer_journal`, `subscriptions`. Content: `scripture_translations`, `scripture_content`, `daily_verses`, `daily_prayers`, `learning_paths`, `learning_lessons`, `quiz_questions`, `quiz_attempts`, `content_chunks`. Platform: `tutor_threads`, `tutor_messages`, `ai_usage_ledger`, `rate_limit_counters`, `feature_flags`, `account_deletion_requests`. Full definitions are in `supabase/migrations`.

## Dependency decisions

| Choice | Reason |
|--------|--------|
| pnpm workspaces, Node 20 | Strict, fast installs, shared packages without publishing. |
| Bare React Native with committed native folders | Three iOS extension targets must survive. Expo prebuild would regenerate and drop them. |
| Expo Modules API only for native modules | Typed Swift and Kotlin module definitions with little boilerplate, without adopting the managed workflow. |
| React Navigation typed routes | Compile time route safety. |
| Zustand, TanStack Query | Zustand for local ritual and settings state, TanStack Query for server state caching and retry. |
| Zod everywhere | One schema source for runtime validation and types, shared with Deno functions. |
| MMKV plus Keychain/Keystore adapter | Fast cache for non sensitive data. Tokens stay in secure storage. |
| Notifee, no remote push | Local scheduling covers v1 reminders without a push backend or APNs and FCM setup. |
| i18next | UI language and Bible translation are independent settings. |
| Supabase | Auth, Postgres with RLS, Edge Functions, pgvector in one managed service. |
| RevenueCat | Cross store entitlement handling and a webhook as single writer. |
| OpenAI behind a provider interface | Swap or mock without touching the pipeline. Models from env. |
| PostHog (autocapture off) and Sentry (scrubbed) | Product metrics with an allow list, crash reporting without content. |

## Rule decisions with consequences

- Server computes `local_date`. Clients send a timestamp for diagnostics only.
- Subscriptions are written only by the webhook with the service role. RLS gives owners select only.
- Local Postgres runner (R11) exists because the Supabase CLI cannot be installed in the authoring environment. It is a fallback, not a replacement for CI.
