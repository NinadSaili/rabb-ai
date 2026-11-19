#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v supabase >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  supabase db reset
else
  echo "supabase CLI or Docker unavailable: using local PostgreSQL fallback (R11)" >&2
  bash scripts/db-local.sh reset
fi
