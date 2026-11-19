# Demonstration guide (21 November 2026)

This is a demonstration build. Read "What the demo is, and is not" before showing it.

## What the demo is, and is not

Demo mode (`DEMO_MODE=1` at build time) runs the whole Rabb.ai journey on one phone with no backend and no accounts:

| Part | In demo mode |
|------|--------------|
| Screens, navigation, ritual state machine, timer, unlock states, streak | Real code, same as the production build |
| Daily verse and prayer | Placeholder content. KJV text labelled DEV ONLY, licence not verified. Never ship it |
| Server (`/v1`) | Replaced by a local stand-in that follows the same contracts and rules. Nothing is verified by a server, so the timer is reported as "not server verified" |
| App restrictions | SIMULATED. Rabb.ai holds back four pretend apps ("Social feed (demo)" and so on) inside itself. No real app on the phone is restricted |
| Premium, AI tutor, billing | Not active. The Learn tab shows the polite paywall state, with no prices |

A banner on every screen says: DEMO MODE. Restrictions are simulated and are not enforced on this device. Say the same out loud. Do not tell the congregation that Rabb.ai currently blocks apps on a phone. Real Android blocking is written and tested as logic, but has not been run on a device (see `docs/STATUS.md`).

## Script (about 6 minutes)

1. Open the app. Splash, then the promise: "Before the scroll, seek the Word."
2. Tick "I am 13 or older" and Begin. Choose the translation (the demo placeholder).
3. Today's verse appears. This is the first taste of the ritual. Continue.
4. Choose the pretend apps to restrict. Tap Allow on the permission rows (simulated).
5. Morning schedule: leave the start hour, set the reading timer to 30 seconds. Save schedule.
6. Home shows "Restricted (simulated)". Tap "Try opening a restricted app (demo)", open one: the reading prompt appears. This is how a restricted app would look.
7. Back to Home, Start ritual. Read the scripture, tap "I have read this". Read the prayer, tap Amen.
8. Reading time: Start timer. Finish stays disabled until 30 seconds pass on the device clock that cannot be changed from settings.
9. Well done. Tap "Unlock my apps". The app says: "Unlocked (simulated)". Open the demo apps again: nothing is restricted.
10. Habits tab: streak of 1.
11. Settings, Privacy and emergency bypass: hold the button for 5 seconds, confirm. This shows the always-available way out.
12. To repeat the demo: Try opening a restricted app, then "Reset demo".

## If something goes wrong

* Stuck on a screen: close and reopen the app. State is kept on the phone.
* Wrong state before the demo: open the demo shield screen and tap "Reset demo".
* Never promise a date for real blocking. Say that Android blocking is being tested on real phones and depends on phone settings, and that it will say honestly what it can and cannot do.

## Install

See `docs/ANDROID_BUILD.md`. In short: run the `android-apk` workflow in GitHub Actions with "Build in DEMO MODE" ticked, download the `rabbai-android-apk` artifact, and install the APK on the phone (Settings, allow installing from this source).
