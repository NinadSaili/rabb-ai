#!/usr/bin/env bash
# Chunks and embeds approved scripture and published lessons into content_chunks.
# Needs SUPABASE_DB_URL and the AI provider environment (see .env.example). INGEST_ALLOW_DEV=1 includes DEV ONLY fixtures.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${DENO_CERT:-}" ] && [ -n "${SSL_CERT_FILE:-}" ] && [ -f "${SSL_CERT_FILE}" ]; then export DENO_CERT="$SSL_CERT_FILE"; fi
DENO="$(command -v deno || echo "$PWD/node_modules/.bin/deno")"
exec "$DENO" run --config supabase/functions/deno.json -A supabase/functions/scripts/ingest_main.ts
