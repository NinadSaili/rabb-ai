#!/usr/bin/env bash
# Runs Deno unit and integration tests for Edge Functions.
# Integration tests need a database with migrations and seeds. They use RABB_TEST_DB_URL, default: the local fallback database.
set -euo pipefail
cd "$(dirname "$0")/.."
export RABB_TEST_DB_URL="${RABB_TEST_DB_URL:-postgresql://postgres:postgres@127.0.0.1:5432/${RABB_LOCAL_DB:-rabb_local}}"
if [ -z "${RABB_SKIP_DB_RESET:-}" ] && ! command -v supabase >/dev/null 2>&1; then bash scripts/db-local.sh reset >/dev/null; fi
if [ -z "${DENO_CERT:-}" ] && [ -n "${SSL_CERT_FILE:-}" ] && [ -f "${SSL_CERT_FILE}" ]; then export DENO_CERT="$SSL_CERT_FILE"; fi
DENO="$(command -v deno || echo "$PWD/node_modules/.bin/deno")"
exec "$DENO" test --config supabase/functions/deno.json -A supabase/functions "$@"
