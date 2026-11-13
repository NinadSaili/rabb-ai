# Android build and install

## Which build approach is required

| Approach | Works for this app? | Why |
|----------|--------------------|-----|
| Expo Go | No | Expo Go ships a fixed set of native modules. Rabb.ai needs MMKV, Keychain, Notifee, RevenueCat and its own Kotlin module (`apps/mobile/modules/rabb-blocking`). |
| Expo managed workflow, `expo prebuild`, EAS Build | Not used | The project is bare React Native with committed `android/` and `ios/` folders. `expo prebuild` would regenerate the native folders and drop the iOS extension targets (AGENTS.md). |
| Development build (Gradle debug APK plus Metro) | Yes, for development | Real native code, JS loaded from Metro. |
| Standalone APK (Gradle release task with the JS bundle embedded, debug signed) | Yes, for the demonstration | Installs and runs with no computer attached. Not suitable for the Play Store (debug signing key). |

Native app restrictions need the native module, so they need a native build (the last two rows). No build, test or CI result in this repository proves that blocking works on a device. See `docs/STATUS.md`.

## Prerequisites

* Node 20, pnpm 10 (`corepack enable`), JDK 17.
* Android SDK with platform 37, build tools 37.0.0, NDK 27.1.12297006, CMake 3.22.1 (Android Studio installs these, or use `sdkmanager`).
* An Android phone (Android 8.0, API 26 or newer) with USB debugging, or permission to install from an unknown source.
* Blocking tests need Usage Access and display-over-other-apps permissions, and a Pixel plus a Samsung or Xiaomi device for the OEM checks in `docs/ANDROID_BLOCKING.md`.

The authoring environment for this repository had no Android SDK (R27), so the APK is built by GitHub Actions.

## Build the APK in GitHub Actions (no local SDK needed)

1. GitHub, Actions, `android-apk`, Run workflow, branch `claude/happy-einstein-l8jooj`.
2. Variant `Release` (standalone, JS embedded). Tick "Build in DEMO MODE" for the congregation demo. Untick it for a real build.
3. When the run is green, open it and download the artifact `rabbai-android-apk`.
4. Pushes to `claude/**` that touch `apps/mobile`, `packages` or the workflow also build it automatically.

## Build locally

```bash
pnpm install
printf 'DEMO_MODE=1\n' > apps/mobile/.env          # demo build. For a real build copy apps/mobile/.env.example and fill public values
cd apps/mobile/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a      # standalone APK
# or ./gradlew assembleDebug   for a development build that loads JS from Metro (run `pnpm --filter @rabb/mobile start` too)
```

The APK is written to `apps/mobile/android/app/build/outputs/apk/<variant>/`.

## Install

```bash
adb devices                                  # the phone must be listed
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Without a computer: copy the APK to the phone, open it, and allow installing from that source when Android asks.

## Checks that run without a device

```bash
pnpm lint && pnpm typecheck && pnpm test             # includes the demo journey UI test
pnpm check:release-bundle                            # a non-demo bundle must contain no placeholder scripture or demo API
pnpm --filter @rabb/mobile android:logic-test        # Kotlin decision logic on the JVM
cd apps/mobile && npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output /tmp/app.bundle
```

## Monorepo notes

`node_modules` is hoisted to the repository root (`.npmrc`: `node-linker=hoisted`). `settings.gradle` and `app/build.gradle` therefore find React Native, its Gradle plugin, codegen, the CLI and Expo's Gradle plugins through Node resolution, and `metro.config.js` watches the workspace root.

## Known build risks

* Expo 58 Gradle autolinking and the local module `modules/rabb-blocking` (Kotlin) are wired from the Expo packages in `node_modules`. Compile errors in the Kotlin module, if any, appear only when Gradle compiles it (R18, R27).
* `targetSdk` follows the React Native template (36). Check the current Play requirement before any store release (R23).
