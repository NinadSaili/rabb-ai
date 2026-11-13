# Android blocking

Status: Kotlin sources written in Milestone 5. Gradle build, spike and device tests are BLOCKED in the authoring environment (no Android SDK, no device). Nothing marked "Expected" has been observed on a device.

## Honest position

Android has no public app lock API. `UsageStatsManager` reports usage. The path used here is a consent based prototype: Usage Access permission, a foreground service that detects the foreground app, and a block screen shown with the overlay permission. It can be killed by the OS, by battery management and by OEM task killers. Rabb.ai never claims guaranteed enforcement, and the status screen says what is enforced on this device right now.

## Capability tiers

| Tier | Meaning | Requirements | Flag |
|------|---------|--------------|------|
| 0 | Reminders only. No blocking. | Notification permission (optional) | always available |
| 1 | Foreground app detection plus a block screen | Usage Access, overlay permission, foreground service running, notification permission for the service notification | `android_tier1_enabled` (prototype off in production until Play review) |
| 2 | Accessibility based detection | AccessibilityService enabled by the user | `android_accessibility_enabled`, default off, separate `accessibility` build flavor. Not shipped in v1 without owner approval. |

The status screen reads each requirement from the OS at display time (permission checks, service-running check, battery optimization state, last heartbeat) and shows the highest tier that is currently true, plus the list of unmet requirements.

## Rules

- `<queries>` with a launcher intent filter for package visibility. `QUERY_ALL_PACKAGES` is not requested.
- Prominent disclosure and consent before each sensitive permission. Users are never prevented from revoking a permission or stopping the service.
- Selected package names stay on device in encrypted DataStore (Tink via `androidx.security`, key in Android Keystore). They are never logged, uploaded or put in analytics.
- Handled lifecycle events: process death (service restart with `START_STICKY` plus WorkManager watchdog), reboot (`BOOT_COMPLETED` receiver), permission revocation (detected on each tick, state falls to the lower tier and the UI says so), battery optimization (status plus guidance).
- Foreground service type `specialUse` on Android 14 and later with the required property explanation. To be confirmed during Play policy review (R2).

## Detection and block flow

1. Foreground service polls `UsageStatsManager.queryEvents` for the latest `ACTIVITY_RESUMED` event on a short interval (500 ms to 1 s while the screen is interactive, stopped when the screen is off).
2. If the package is in the selected set and the restriction is active (ritual incomplete for current local_date, inside an active window, not unlocked, not bypassed), start `BlockActivity` (needs overlay permission to start from the background on Android 10 and later).
3. `BlockActivity` offers: open Rabb.ai ritual, emergency bypass, close.
4. Decision logic (is a restriction active for this package at this time) is pure Kotlin (`RestrictionDecision`) with JVM unit tests and no Android imports.

## Play policy analysis

| Topic | Policy surface | Position |
|-------|----------------|----------|
| Overlay (`SYSTEM_ALERT_WINDOW`) | Permissions policy, Display over other apps | Used to show a user requested block screen. Disclosure and consent before request. Flagged until reviewed. |
| Usage Access (`PACKAGE_USAGE_STATS`) | Permissions policy, sensitive data | Used only to detect the foreground app on device. Nothing uploaded. Disclosure shown. |
| Foreground service | Foreground service types declaration (Android 14 and later) | `specialUse` with explanation, Play Console declaration required. |
| AccessibilityService | Accessibility API policy | Not used in v1. If added: `isAccessibilityTool` must stay unset because the app is not an accessibility tool. Needs prominent disclosure and a declaration with a demo video. Remote flag default off. |
| `QUERY_ALL_PACKAGES` | Package visibility policy | Not requested. Use `<queries>`. |
| Deceptive behaviour | User Data and Device and Network Abuse | Store copy states plainly that Rabb.ai asks the user to restrict their own apps, that it can be disabled at any time, and that enforcement depends on device settings. |

## Permission declaration drafts

Prominent disclosure (shown before Usage Access):

> Rabb.ai needs Usage Access to see which app is open so it can show your reading prompt when you open an app you chose to restrict. The list of apps stays on this device. We do not upload it. You can turn this off at any time in Android Settings.

Overlay:

> Rabb.ai shows a full screen reading prompt over an app you chose to restrict. This needs permission to display over other apps. You can remove the permission at any time in Android Settings.

Play Console foreground service declaration (specialUse):

> The service detects whether an app the user selected is in the foreground so the app can show the user's own daily reading prompt. It runs only while the user has enabled restrictions and shows a persistent notification.

## OEM guidance shown in app

Per manufacturer steps with a link to Android Settings battery optimization and the vendor's autostart page: Samsung (Battery, Background usage limits, Never sleeping apps), Xiaomi (Autostart, Battery saver, No restrictions), Huawei (App launch, manage manually), Oppo and Vivo (Autostart, Battery optimization), Pixel (Battery, Unrestricted). Text is advice, not a guarantee, and says "steps vary by software version".

## Spike protocol

Record on at least one Pixel and one Samsung or Xiaomi device.

| # | Step | Expected | Result |
|---|------|----------|--------|
| A1 | Open Usage Access settings from the app, grant, return | `hasUsageAccess` true on return | not run |
| A2 | Start the foreground service, open a selected app | Detected within 1 s | not run |
| A3 | Block screen over the selected app with overlay permission | BlockActivity shown | not run |
| A4 | Same without overlay permission | Not shown, status tier drops, UI says so | not run |
| A5 | Swipe app from recents | Service survives or WorkManager restarts it within the watchdog period | not run |
| A6 | Reboot | Service restarts from the boot receiver, tier recalculated | not run |
| A7 | Battery saver on | Record whether detection continues | not run |
| A8 | Revoke Usage Access while running | Tier drops within one tick, no crash | not run |
| A9 | Idle 30 minutes screen off then on | Detection resumes | not run |
| A10 | Unlock via ritual completion, open selected app | No block until window end rules apply | not run |
| A11 | Emergency bypass | Block ends immediately, no network needed | not run |

## Native test plan

Usage permission granted and revoked, overlay permission granted and revoked, selected app launch detection, process death, reboot, permission revocation, battery saver, OEM specific behaviour. Expected results are in the spike table and apply to the full test run.

## Tested devices

| Date | Device | Android | OEM skin | Cases passed | Notes |
|------|--------|---------|----------|--------------|-------|
| none recorded | | | | | BLOCKED: no device access |

## Implementation map

| Piece | File (apps/mobile/modules/rabb-blocking) | State |
|-------|------------------------------------------|-------|
| Decision logic (pure Kotlin, no Android imports) | `android/src/main/java/com/rabbai/blocking/logic/RestrictionDecision.kt` | IMPLEMENTED, 13 JVM tests pass (`pnpm --filter @rabb/mobile android:logic-test`) |
| Tier resolver and unmet requirement list | `logic/TierResolver.kt` | IMPLEMENTED, 9 JVM tests pass |
| Encrypted DataStore (Tink AES-256-GCM, Android Keystore master key) | `SecureStore.kt` | written, not compiled (no Android SDK) |
| Permission reads and settings intents | `Permissions.kt` | written, not compiled |
| Foreground detection service (UsageStatsManager polling) | `ForegroundDetectionService.kt` | written, not compiled |
| Block screen with a way out (open app, bypass, go back) | `BlockActivity.kt` | written, not compiled |
| Boot receiver and WorkManager watchdog | `BootReceiver.kt` | written, not compiled |
| Expo module bridge | `RabbBlockingModule.kt`, `src/index.ts` | written, not compiled |
| Manifest permissions, `<queries>`, service type `specialUse` | `android/src/main/AndroidManifest.xml` | written, not compiled |

The JS layer (`apps/mobile/src/services/blocking`) defines the contract, reads capabilities, and falls back to `UnavailableBlockingService` (Tier 0, never claims a restriction) when the module is missing.

Decision notes: restrictions are window based. Completing a ritual or using the emergency bypass writes `suspendedUntil`. Detection runs only while the screen is interactive. Revocation of Usage Access is noticed on the next tick and the status screen drops to Tier 0.

CI runs the JVM logic tests on every push (`android-logic` job). Nothing else in this table has been built or run on a device. See `docs/STATUS.md`.
