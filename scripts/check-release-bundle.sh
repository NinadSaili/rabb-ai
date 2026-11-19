#!/usr/bin/env bash
# Builds a NON-demo Android JS bundle with Metro and fails if placeholder (DEV ONLY, unlicensed) scripture or the demo API is inside.
set -euo pipefail
cd "$(dirname "$0")/../apps/mobile"
OUT="${TMPDIR:-/tmp}/rabb-release-check.bundle"
cp -f .env .env.check.bak 2>/dev/null || true
printf 'DEMO_MODE=\n' > .env
trap 'if [ -f .env.check.bak ]; then mv -f .env.check.bak .env; else rm -f .env; fi' EXIT
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output "$OUT" --reset-cache >/dev/null 2>&1
fail=0
for needle in "only begotten Son" "demo.sessions.v1" "King James Version (DEMO placeholder)"; do
  if grep -q "$needle" "$OUT"; then echo "FAIL: release bundle contains: $needle"; fail=1; fi
done
[ "$fail" = 0 ] && echo "ok: release bundle contains no demo fixtures or demo API"
exit $fail
