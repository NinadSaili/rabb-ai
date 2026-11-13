# Test plan

## Tooling

| Layer | Tool | Command |
|-------|------|---------|
| Unit (packages, app logic) | Jest | `pnpm test` |
| Component | React Native Testing Library | `pnpm test` |
| RLS | pgTAP | `pnpm db:test` |
| Edge Functions | `deno test` | `pnpm functions:test` |
| AI evals | Deno script over `supabase/tests/ai-evals` | `pnpm ai:evals` |
| End to end | Maestro flows in `apps/mobile/e2e` | device only |
| Lint and types | ESLint, `tsc --noEmit` | `pnpm lint`, `pnpm typecheck` |

## Required unit coverage

| Area | Cases |
|------|-------|
| Ritual state machine | every legal transition, every illegal (state, event) pair rejected, timer optional, duplicate completion, expiry on day roll |
| Day boundary | 02:59 and 03:00, timezone change mid session, DST forward and back, zones with midnight shifts |
| Schedule calculations | weekly recurrence, overlap resolution, DST, timezone travel, next restriction time |
| Streaks | consecutive days, one grace day, two misses in a week break, longest streak, week boundaries |
| Entitlements | premium gate, expired, grace period, missing row |
| Offline queue and cache | persistence across restart, ordering, retry with same key, 7 day prefetch, first completion wins |
| Analytics allow list | unknown event rejected, unknown property rejected, free text rejected, every emitted event in source is allow listed |
| Citation verifier | exact match, whitespace and punctuation normalisation, partial quote, wrong reference, invented verse, repair |

## Integration

Anonymous sign in and linking, daily ritual retrieval, ritual completion and idempotency, RLS isolation for every user table, webhook signature and replay, tutor entitlement and quota, account deletion.

## pgTAP

For each user table: user A cannot select, insert for, update or delete user B rows. Anonymous role sees nothing. Service role only tables reject authenticated writes (`subscriptions`, content tables). Constraint tests: unique completed session per (user, schedule, local_date), unique step per session, unique idempotency key, `ai_opt_in` default false.

## AI evals

At least 40 prompts in `supabase/tests/ai-evals/prompts.json`, grouped: normal study (10), hard doctrine (6), prompt injection (8), divine voice and prophecy requests (6), self harm and crisis (5), fabricated verse requests (5). Each prompt has machine checkable pass criteria: required block types, forbidden phrases, required fixed message id for crisis, verified citations only, refusal marker for divine voice. The harness runs against a mock provider in CI and against the real provider manually.

## Native test plans

iOS and Android checklists live in `IOS_SCREEN_TIME.md` and `ANDROID_BLOCKING.md`.

## Accessibility audit (Milestone 10)

VoiceOver and TalkBack walk through screens 1 to 22, Dynamic Type at the largest accessibility size and Android font scale 200 percent, dark mode, reduce motion, contrast checks for both themes (automated in `theme` tests).

## Performance budget

Cold start under 2.5 seconds on a mid range Android device. Ritual screen interactive under 1 second from cache. Measured with `react-native-performance` marks on device. Status BLOCKED until a device is available.

## Exit rule

A milestone closes only when the commands in `IMPLEMENTATION_PLAN.md` pass or each failure is recorded in `STATUS.md` with a blocker.
