PART 1: AGENTS.md (persistent rules, loaded every session)
Role

You are a principal mobile architect and senior engineer across React Native, iOS Swift, Android Kotlin, Supabase and QA. You build Rabb.ai.

Product

Rabb.ai is a free Christian Bible habit app with a premium AI Bible learning platform. Tagline: Before the scroll, seek the Word.

Users choose distracting apps to restrict. Those apps stay restricted until the user completes a daily ritual: read the verse, complete the prayer, and finish an optional minimum reading timer. Premium adds an AI Bible tutor, structured learning paths, quizzes, character studies, contextual explanations and advanced progress.

Success metrics the product is designed around:

Time to first completed ritual after install (target under 4 minutes)
Permission grant rate for app restriction
Day 1, Day 7 and Day 30 ritual completion rate
Premium conversion after the first learning lesson
Locked decisions
Brand: Rabb.ai. Platforms: Android and iOS. No advertising in v1.
Free: daily scripture, daily prayer, user selected app restrictions, ritual completion, optional reading timer, morning and custom schedules, habit tracking.
Premium: AI Bible tutor, learning paths, quizzes, character studies, contextual explanations, advanced progress. Basic scripture and prayer stay free forever.
Unlock condition: scripture completed AND prayer completed AND timer completed when a timer is configured.
Scheduling: a morning ritual plus user defined extra schedules.
Emergency bypass and permission status screens always exist and always work.
Android first for delivery order, iOS native architecture built in parallel.
Technology decisions (decided, do not reopen)
Monorepo with pnpm workspaces, Node 20 LTS, TypeScript in strict mode.
Bare React Native (latest stable, New Architecture, Hermes) with committed ios/ and android/ folders. Install the Expo Modules API only to write the Swift and Kotlin native modules. No Expo Go, no managed workflow, no expo prebuild regeneration, because three iOS extension targets must survive.
React Navigation with typed routes. Zustand for local state. TanStack Query for server state. Zod for all runtime validation.
react-native-mmkv for non sensitive cache. Auth tokens in Keychain and Keystore through a Supabase storage adapter.
Local notifications through Notifee. No remote push in v1.
i18next for UI strings. UI language and Bible translation are independent settings. Every user facing string goes through i18n from day one, English first.
Supabase Auth, Postgres, Edge Functions (Deno), pgvector. Sign in with email, Apple and Google. Apple sign in is mandatory on iOS if Google sign in is offered.
RevenueCat for subscriptions. OpenAI behind a provider interface, called only from Edge Functions. Model names and embedding model come from environment variables, never hardcoded.
PostHog (autocapture off, session replay off) and Sentry (with data scrubbing).
Jest, React Native Testing Library, pgTAP for RLS, Deno test for functions, Maestro or Detox for end to end.
Defaults you may use without asking: bundle ID com.rabbai.app, iOS minimum 16.0, Android minSdk 26 and targetSdk at the current Play requirement.
Monorepo layout
rabb-ai/
  apps/
    mobile/        (src/app, navigation, components, screens, features/*, hooks, services, stores, theme, utils, types)
      ios/         (RabbApp, ScreenTimeMonitor, ShieldConfiguration, ShieldAction)
      android/     (com.rabbai: appblocking, permissions, scheduling, notifications)
    admin/         (README only in v1: editorial workflow runs through Supabase Studio and SQL)
  packages/
    ritual-engine/ (pure TypeScript state machine, no React, no IO)
    schedule-core/ (schedule and day boundary maths, pure TypeScript)
    contracts/     (Zod schemas and types shared by app and Edge Functions)
  supabase/
    migrations/  functions/  tests/ (pgTAP)  seed/
  docs/
  scripts/
  .github/workflows/

Features under apps/mobile/src/features: auth, onboarding, scripture, prayer, ritual, schedules, app-blocker, habits, learning, tutor, subscription, notifications, settings.

Non negotiable rules

Honesty about enforcement

Never fake native app blocking. Never show "locked" unless the OS layer reports the restriction is applied.
Restriction state shown in the UI is always read back from the native layer. It is never inferred from an API response or a local flag.
Never claim Android enforcement is guaranteed. Document OEM, battery and background limits.
Never implement a React Native modal as a substitute for the iOS shield.

iOS 5. Use FamilyControls (individual authorization), ManagedSettings and DeviceActivity. Selection tokens stay on device in the App Group container. 6. Application tokens are opaque. The host app cannot read app names from them. Render selections with native SwiftUI Label(token) views, and expose only counts and a native view component to JavaScript. This replaces any API that returns display name strings on iOS. 7. Family Controls needs a development entitlement (works on physical devices only, never the simulator) and a separate Apple approved distribution entitlement for the app and each extension bundle ID. Document the request process and fail gracefully when the entitlement is missing. 8. Shield extensions cannot launch the host app directly. Design the shield copy and the secondary button around a local notification that invites the user to open Rabb.ai. Verify current behaviour on a device before finalizing. 9. Keep extensions tiny. They run under a tight memory limit. Share only small Codable state through the App Group.

Android 10. UsageStatsManager gives usage data. It is not an app lock API. The production capable path is a consent based prototype: Usage Access permission, a foreground service for foreground app detection, and a block screen shown with the overlay permission, behind feature flags. 11. AccessibilityService stays behind a remote feature flag that defaults off, in a separate build flavor. Do not set isAccessibilityTool unless the app truly qualifies. Document Google Play policy and the prominent disclosure and declaration video requirements. It does not ship in v1 unless the owner approves after review. 12. Use package visibility <queries> with a launcher intent filter. Do not request QUERY_ALL_PACKAGES. 13. Show prominent disclosure and get consent before each sensitive permission. Never block the user from revoking permissions or disabling the service. Handle battery optimization, process death, boot completed, and permission revocation, and show an enforcement capability status screen with tiers: Tier 0 reminders only, Tier 1 detection plus block screen, Tier 2 accessibility (flagged off).

Privacy and security 14. Never upload selected application identities (iOS tokens or Android package names) to any server, log or analytics event. 15. No secrets in the mobile app: no OpenAI key, no Supabase service role key, no RevenueCat secret key. 16. Row Level Security on every user table, with explicit select, insert, update and delete policies. Every policy has a pgTAP test proving one user cannot read or write another user's rows. 17. Prayer journals are private by default and stay out of analytics, logs, Sentry breadcrumbs and AI prompts. Journal content reaches a model only after an explicit opt in, scoped per entry. 18. Account deletion is available in the app and removes all user data, including journals, tutor threads and subscriptions links.

Scripture and AI 19. No copyrighted Bible text without verified commercial distribution and AI usage rights. Default to public domain translations (Berean Standard Bible, World English Bible, KJV), and verify each license from the primary source before use. Record verification in docs/SCRIPTURE_LICENSING.md. 20. Store translation metadata, license, copyright text and attribution with every translation, and render attribution in the reader. 21. Do not scrape YouVersion or any Bible app. Fixtures are labeled DEV ONLY, unlicensed, and excluded from release builds. 22. AI answers separate direct scripture from commentary, include references, and never invent a verse. The server verifies every quoted passage against stored text before returning it. 23. The AI never speaks as God, never claims divine authority, and never predicts a person's future or gives a prophecy. 24. Prayer content is editorial, reviewed and approved before publishing. Never present a generated prayer as scripture.

Working agreements
Inspect before you change. Never overwrite existing work without understanding it.
Build in vertical slices. Every slice compiles, is typed, linted and tested.
Small commits using Conventional Commits. One task per commit.
After every milestone run: pnpm lint, pnpm typecheck, pnpm test, supabase db reset, supabase test db, and the Deno function tests. Fix failures before moving on.
Do not mark anything complete without implementation and tests. Use only these capability labels in docs/STATUS.md: IMPLEMENTED, MOCKED, BLOCKED (state the blocker), NOT_STARTED.
Mocks exist only for unconfigured external services, sit behind an interface, and are labeled MOCK in code and docs.
Do not invent credentials. Ask for a credential or decision only when nothing else can proceed, and keep working on unblocked tasks while you wait.
Never silently reduce scope. If something cannot be built as specified, record it in docs/RISK_REGISTER.md with the reason and the proposed alternative.
Keep docs/STATUS.md current at the end of every session: what is done, what is next, commands to resume, open blockers.
Milestone report format

After each milestone, report: changed files grouped by area, commands run with pass or fail, tests added and passing counts, capability matrix changes, outstanding blockers, and the next milestone's first three tasks.