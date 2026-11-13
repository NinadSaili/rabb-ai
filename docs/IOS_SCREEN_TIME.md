# iOS Screen Time

Status: code written in Milestone 4. Spike and device verification are BLOCKED in the authoring environment (no Mac, no Xcode, no physical iPhone, no Apple approved entitlement). Nothing on this page marked "Expected" has been observed on a device.

## Architecture rules

- FamilyControls with `.individual` authorization, ManagedSettings, DeviceActivity. iOS minimum 16.0.
- Selection (`FamilyActivitySelection`) is encoded to the App Group container. It never leaves the device.
- Application tokens are opaque. The host app cannot read app names. JS receives `{count, categoryCount, webDomainCount}`. The UI shows selections through a native SwiftUI `Label(token)` view (`SelectedAppsSummaryView`).
- Extensions stay tiny. They share only small Codable state through the App Group.
- Shield extensions cannot open the host app. Shield copy and the secondary button point to a local notification that invites the user to open Rabb.ai.
- No React Native modal substitutes for the shield.

## Targets and bundle IDs

| Target | Bundle ID | Extension point |
|--------|-----------|-----------------|
| RabbApp | com.rabbai.app | app |
| ScreenTimeMonitor | com.rabbai.app.ScreenTimeMonitor | com.apple.deviceactivity.monitor-extension |
| ShieldConfiguration | com.rabbai.app.ShieldConfiguration | com.apple.shield-configuration-service |
| ShieldAction | com.rabbai.app.ShieldAction | com.apple.shield-action-service |

App Group: `group.com.rabbai.app`. Each of the four targets needs the App Group capability and the Family Controls (Development, later Distribution) entitlement `com.apple.developer.family-controls`.

## Exact Xcode setup

1. Open `apps/mobile/ios/RabbApp.xcworkspace` after `pod install`.
2. Select team, set bundle IDs per the table, set minimum deployment to 16.0 on every target.
3. For each target, Signing & Capabilities: add App Groups (`group.com.rabbai.app`) and Family Controls.
4. Confirm each target's `.entitlements` file contains `com.apple.developer.family-controls` and `com.apple.security.application-groups`.
5. Embed the three extensions in RabbApp through its Embed Foundation Extensions build phase (Xcode 15 and later).
6. Add `Shared/RabbSharedState.swift` to all four targets (target membership). Keep it under 100 lines and free of third party imports.
7. Build to a physical device. The simulator cannot grant Family Controls authorization.
8. Never run `expo prebuild`. It would drop the extension targets.

## Spike protocol (physical device, time box 2 days)

Record Pass, Fail or Partial with iOS version and device model in the result table.

| # | Step | Expected | Result |
|---|------|----------|--------|
| S1 | Call `requestAuthorization(for: .individual)` on a device with a development entitlement | System consent sheet, status `approved` | not run |
| S2 | Same call without the entitlement | Throws, app shows the entitlement-missing state (Tier 0 copy), no crash | not run |
| S3 | Present `FamilyActivityPicker`, select 2 apps, 1 category, 1 web domain, confirm | Selection returned, counts 2, 1, 1 | not run |
| S4 | Cancel the picker | Previous selection unchanged, no error state | not run |
| S5 | Set `store.shield.applications` from the selection | Opening a selected app shows the shield | not run |
| S6 | Clear the shield | Selected app opens normally | not run |
| S7 | Register a DeviceActivity schedule starting in 2 minutes and ending in 4 | `intervalDidStart` and `intervalDidEnd` fire, store changes accordingly | not run |
| S8 | Write state in the app, read it in each extension, and the reverse | Same value read | not run |
| S9 | Customize shield title, subtitle and buttons | Text displayed | not run |
| S10 | ShieldAction secondary button posts a local notification | Notification appears, tapping opens Rabb.ai | not run |
| S11 | Revoke authorization in Settings, Screen Time | App detects on next foreground, shows the revoked state, claims no restriction | not run |
| S12 | Kill the app, reboot, wait for schedule start | Shield applies without the app launching | not run |
| S13 | Memory use of each extension under Instruments | Within the system limit with margin | not run |

Questions the spike must answer before M4 exit: does the extension post notifications (S10), does a schedule survive reboot (S12), does `intervalDidStart` fire when registered while already inside the interval.

## Failure paths implemented

| Condition | Native result code | UI behaviour |
|-----------|--------------------|--------------|
| Entitlement missing | `entitlement_missing` | Explain, offer Tier 0 reminders, do not say locked |
| Authorization denied | `authorization_denied` | Explain, deep link to Settings, no restrictions claimed |
| Authorization revoked later | `authorization_revoked` | Read back on foreground, show revoked, clear stored state flags |
| Picker cancelled | `picker_cancelled` | Keep previous selection |
| Extension crash | `extension_unresponsive` (heartbeat timestamp in App Group is stale) | Show reduced enforcement, offer retry and reinstall guidance |

## Apple entitlement request

Submit through the Family Controls (Distribution) request form for the app and each extension bundle ID (four requests, or one request listing all four, per Apple's current form). Draft text:

> Rabb.ai is a Christian Bible habit app. A user voluntarily chooses apps to restrict and completes a short daily ritual (reading a verse and a prayer, with an optional timer) to remove the restriction for the day. We use Family Controls with individual authorization so adults can manage their own device. The FamilyActivityPicker selection never leaves the device and is stored only in our App Group. The ManagedSettings shield is applied by our DeviceActivity monitor extension at the start of the user's schedule and removed when the ritual is completed, the window ends, or the user uses the emergency bypass. We do not collect, transmit or analyse which apps were selected. Users can revoke access at any time in Settings, Screen Time. Bundle IDs: com.rabbai.app, com.rabbai.app.ScreenTimeMonitor, com.rabbai.app.ShieldConfiguration, com.rabbai.app.ShieldAction.

## TestFlight notes

- Family Controls distribution entitlement must be approved before a TestFlight build that uses it can be installed on testers' devices through App Store Connect.
- Internal testers can use development-signed builds installed through Xcode meanwhile.
- Review notes: explain the voluntary self-management purpose, provide a demo account path (anonymous start), state that no child supervision features exist.
- Verify the three extension targets are signed with provisioning profiles that carry the entitlement.

## Native test plan

| Area | Case | Expected |
|------|------|----------|
| Authorization | granted | `authorized` status returned from native read-back |
| | denied | `authorization_denied`, no shield applied |
| | revoked in Settings | status read back as not authorized, UI says restrictions are not active |
| Selection | pick apps | counts update, summary view lists tokens |
| | empty selection | apply is a no-op, UI explains |
| Shield | on | selected app shows shield, UI shows "Restricted" after native read-back |
| | off after ritual | app opens, UI shows Unlocked (verified by OS) |
| Schedule | start callback | shield applied if ritual incomplete for local_date |
| | end callback | shield cleared |
| Extensions | App Group round trip | state equal on both sides |
| Entitlement | missing | graceful Tier 0 fallback |
| Emergency bypass | hold 5 s, confirm | shield cleared, no network needed |

## Device results

| Date | Device | iOS | Tester | Spike cases passed | Notes |
|------|--------|-----|--------|--------------------|-------|
| none recorded | | | | | BLOCKED: no device access |
