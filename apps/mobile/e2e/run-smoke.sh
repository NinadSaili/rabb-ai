#!/usr/bin/env bash
# Runs on an Android emulator (see .github/workflows/android*.yml): install, launch, log diagnostics, run the Maestro demo journey.
set -u
APK="${1:-out/app-release.apk}"
# A slow CI emulator can show 'System UI / Launcher isn't responding' over the app. Hide system error dialogs for the test run.
adb shell settings put global hide_error_dialogs 1 || true
adb install -r "$APK" || exit 1
adb shell pm grant com.rabbai.app android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb logcat -c
adb shell am start -W -n com.rabbai.app/.MainActivity
sleep 10
adb exec-out screencap -p > launch.png
echo "--- app log after launch"
adb logcat -d -v brief | grep -E "ReactNativeJS|AndroidRuntime|FATAL|MMKV|Hermes|rabbai" | tail -60
if adb logcat -d | grep -q "FATAL EXCEPTION"; then echo "App crashed on launch"; adb logcat -d | grep -A25 "FATAL EXCEPTION" | head -60; exit 1; fi
echo "--- view hierarchy"
maestro hierarchy 2>&1 | head -c 5000
code=1
for attempt in 1 2; do
  echo "--- maestro attempt $attempt"
  maestro test --format junit --output maestro-report.xml apps/mobile/e2e/demo-journey.yaml && { code=0; break; }
  code=$?
  echo "--- screen text after failed attempt $attempt (uiautomator)"
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1
  adb shell cat /sdcard/window.xml | grep -oE '(text|content-desc)="[^"]+"' | sort -u | head -40
  adb exec-out screencap -p > failed.png
  adb shell am force-stop com.rabbai.app
done
if [ $code -ne 0 ]; then
  echo "--- app log after failed flow"
  adb logcat -d -v brief | grep -E "ReactNativeJS|AndroidRuntime|FATAL" | tail -80
fi
exit $code
