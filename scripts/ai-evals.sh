#!/usr/bin/env bash
# Runs the AI tutor evaluation set (supabase/tests/ai-evals). Mock provider by default.
# Live: AI_PROVIDER=openai OPENAI_API_KEY=... AI_CHAT_MODEL=... AI_EMBEDDING_MODEL=... AI_MODERATION_MODEL=... bash scripts/ai-evals.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export RABB_TEST_DB_URL="${RABB_TEST_DB_URL:-postgresql://postgres:postgres@127.0.0.1:5432/${RABB_LOCAL_DB:-rabb_local}}"
if [ -z "${RABB_SKIP_DB_RESET:-}" ] && ! command -v supabase >/dev/null 2>&1; then bash scripts/db-local.sh reset >/dev/null; fi
export DENO_CERT="${DENO_CERT:-${SSL_CERT_FILE:-}}"
DENO="$(command -v deno || echo "$PWD/node_modules/.bin/deno")"
exec "$DENO" test --config supabase/functions/deno.json -A supabase/tests/ai-evals "$@"
