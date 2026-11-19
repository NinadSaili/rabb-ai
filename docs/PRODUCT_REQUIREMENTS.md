# Product requirements

Rabb.ai is a free Christian Bible habit app with a premium AI Bible learning platform. Tagline: Before the scroll, seek the Word.

## Success metrics

| Metric | Target |
|--------|--------|
| Time to first completed ritual after install | under 4 minutes |
| Permission grant rate for app restriction | tracked, no target set before beta data |
| Day 1, Day 7, Day 30 ritual completion | tracked |
| Premium conversion after first learning lesson | tracked |

## Scope

Free: daily scripture, daily prayer, user selected app restrictions, ritual completion, optional reading timer, morning and custom schedules, habit tracking. No advertising in v1.

Premium (entitlement named Rabb.ai Premium): AI Bible tutor, learning paths, quizzes, character studies, contextual explanations, advanced progress. Basic scripture and prayer stay free forever.

Platforms: Android and iOS. Android ships first. iOS native architecture is built in parallel.

## Unlock condition

Scripture completed AND prayer completed AND timer completed when a timer is configured.

## Ritual rules (authoritative)

These rules are implemented exactly. Rules touching OS behaviour are marked UNVERIFIED_ON_DEVICE until a spike result is recorded in the platform documents.

### R-DAY Day boundary

- `local_date = date( (server_now AT TIME ZONE profile.timezone) - interval '3 hours' )`. The ritual day starts at 03:00 local wall clock time. The profile timezone is an IANA name.
- The server computes `local_date`. The client timestamp is diagnostic only and is stored in a separate column that no logic reads.
- Example: 02:30 on 12 March (Pacific/Auckland) belongs to local_date 11 March. 03:00 on 12 March belongs to 12 March.
- DST: because the rule subtracts a fixed three hours from wall clock time, a 23 hour or 25 hour day still yields exactly one `local_date` per calendar day boundary at 03:00 wall clock. For zones that shift clocks at 03:00 or later, the shift moment maps to a local_date by wall clock reading, tested with fixtures.

### R-BIND Session binding

A session is bound to the `local_date` where it started (`ritual_sessions.local_date` is set once at start). Changing timezone mid ritual changes nothing about the bound session. The unique key (user_id, schedule_id, local_date) for completed sessions guarantees one completion.

When `DAY_ROLLED_OVER` is observed (current local_date differs from the session's), an unfinished session becomes EXPIRED. The user starts a new session for the new date.

### R-TIME Server authority and timer validation

- Server time is authoritative for ordering, `local_date` and timer validation.
- The device measures the timer with a monotonic clock (iOS `ProcessInfo.systemUptime` or `CLOCK_MONOTONIC`, Android `SystemClock.elapsedRealtime`) and sends `monotonic_ms`.
- Server stores `received_at` for the start and completion of the timer step. Online validation: `server_elapsed >= required_seconds / 1.05` AND `monotonic_ms >= required_seconds * 1000` AND `monotonic_ms <= server_elapsed * 1.05 * 1000`. This is the 5 percent tolerance.
- Changing the device clock cannot create an early or duplicate completion because no logic uses device wall clock time.
- Offline timer steps (start and completion both arriving after reconnect) cannot be checked against server elapsed time. They are stored with `timer_verified = false`, require `monotonic_ms >= required_seconds * 1000`, and count for the ritual. Trade-off recorded as R9.

### R-IDEM Idempotency

Every mutation carries an `idempotency_key` (UUID v4 generated on the device when the action is enqueued). `ritual_steps.idempotency_key` is unique per user. A retried request returns the originally stored result with the same status code. A reused key with a different payload returns 409 `idempotency_key_reuse`.

### R-OFFLINE Offline behaviour

Today's content is cached (today plus 7 days prefetched). The ritual works offline. The device generates the session id so steps can queue before the first sync. The server binds `local_date` at the time it receives the start request, so a ritual started offline before 03:00 and synced after 03:00 binds to the later date (R16). A queued request that already failed once is sent with `offline_queued: true`. Steps queue in a persistent mutation queue (MMKV) in order. On reconnect the server reconciles with first completion wins: if a completed session already exists for (user, schedule, local_date), later completions return the first result and do not create another.

### R-UNLOCK Unlock is a local OS action

Unlock removes restrictions through the native layer and is independent of backend sync. After removal the UI re-reads native status and shows exactly one of:

1. Unlocked (verified by OS): native status reports no active restriction.
2. Unlock failed: shows the reason, a retry action and the emergency bypass.
3. Unlocked locally, sync pending: native status is unrestricted and the mutation queue holds unsynced ritual mutations.

A network failure never produces a "synced" claim or a "locked" claim. The word "locked" is shown only when the native layer reports the restriction is applied.

### R-DURATION Unlock duration and re-lock

- Each schedule defines a restriction window (start time, end time, weekdays). Completing that schedule's ritual for the current local_date suspends restrictions until the end of the active window. The restriction window of the next occurrence re-applies restrictions at its start time.
- Custom schedules may carry `unlock_until: "midnight"`, valid only for a window that does not cross midnight (database constraint `ritual_schedules_midnight_no_crossing`, API validation, and the form). A window that stays inside the day already ends at or before midnight, so the option has no visible effect today and the app does not offer it in the UI (R17 resolved by removal of the trap, wording left to the product owner). Windows that cross midnight always unlock until the window end, capped at the 03:00 rollover.
- A completion before a window starts (same ritual date) suspends that window too (`suspensionAfterCompletion` in `schedule-core`), so the OS layer does not re-apply restrictions the user already earned.
- A suspension never crosses the 03:00 ritual day rollover.
- A new ritual day (03:00 local) never inherits the previous day's completion. Any window that starts or is still active after 03:00 and has no completed ritual for the new local_date restricts.
- Overlapping schedules: most restrictive wins. Apps are restricted when any active window has an incomplete ritual for the current local_date. Each schedule needs its own completion. The selected app set is shared across schedules in v1.
- What re-locks apps: start of a window with an incomplete ritual, the 03:00 day rollover while a window is active, user re-enabling restrictions, and permission restoration after revocation.
- Emergency bypass suspends restrictions until the end of the active window. It does not count as a completion and does not change streaks.
- UNVERIFIED_ON_DEVICE: iOS DeviceActivity start callbacks fire reliably only while the schedule is registered with the system. Android re-lock relies on the foreground service or a boot and WorkManager watchdog and is best effort on OEM devices.

### R-BYPASS Emergency bypass

Available from the restriction screen and from settings. Friction: hold for 5 seconds, then a confirmation dialog. Local daily count and local log (timestamp and reason code, never an app identity). Removes restrictions immediately and works with no network. Emits `emergency_bypass_used` with no properties that identify apps.

### R-STREAK Streaks

- A day counts when a ritual is completed for that local_date.
- One grace day per week: `STREAK_GRACE_DAYS_PER_WEEK = 1`, a constant in `schedule-core`. A single missed day in a calendar week (Monday to Sunday by local_date) does not break the streak. A second missed day in the same week breaks it. Grace days are consumed automatically and are shown in the calendar as "grace".
- Longest streak is stored and monotonic.
- Streaks use server `local_date`.

## Honest enforcement requirements

- The UI never shows "locked" unless the OS layer reports the restriction applied. State is read back from the native layer, never inferred from an API response or a local flag.
- Android never claims guaranteed enforcement. OEM, battery and background limits are documented and shown on the status screen.
- No React Native modal substitutes for the iOS shield.

## Onboarding order

1. Promise. 2. Translation. 3. First ritual taste with today's verse. 4. App selection with prominent disclosure and permissions. 5. Schedule. 6. Account linking prompt after the first completion. Users start with an anonymous Supabase session.

## Screens

1 Splash, 2 Welcome and onboarding, 3 Account registration and linking, 4 Language and translation selection, 5 App selection and permissions, 6 Schedule configuration, 7 Daily ritual home, 8 Scripture reading, 9 Prayer, 10 Reading timer, 11 Completion and unlock confirmation, 12 Habit dashboard, 13 Schedule management, 14 Basic Bible reader, 15 Premium learning home, 16 Learning path details, 17 Lesson, 18 Quiz, 19 AI tutor, 20 Paywall, 21 Settings and permissions, 22 Privacy and emergency bypass.

## Design requirements

Cream `#FAF7F0` background, charcoal `#1F1F1D` text, muted olive `#5E6B4A` accent. Dark mode `#141412` background with soft off white text. Scripture in Newsreader (or Source Serif 4), interface in Inter. Scripture default 20pt, scaling to at least 200 percent through Dynamic Type and Android font scale. Minimal motion, honour reduce motion. WCAG AA contrast in both modes. All strings through i18next.

## Non-goals for v1

Advertising, remote push, YouVersion content, AccessibilityService blocking (needs owner approval), web app, family or child supervision modes.
