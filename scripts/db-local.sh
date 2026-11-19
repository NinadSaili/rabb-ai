#!/usr/bin/env bash
# Fallback runner for environments without the Supabase CLI or Docker (see docs/RISK_REGISTER.md R11).
# Builds a throwaway database on a local PostgreSQL 16 server that has the pgvector and pgTAP extensions,
# applies supabase/tests/support stubs, all migrations, seeds, then optionally runs pgTAP with pg_prove.
# Usage: scripts/db-local.sh reset|test
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${RABB_LOCAL_DB:-rabb_local}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
as_pg() { if [ "$(id -u)" = "0" ]; then su postgres -c "$*"; else bash -c "$*"; fi; }

ensure_server() {
  if ! as_pg "pg_isready -q"; then
    pg_ctlcluster 16 main start 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do as_pg "pg_isready -q" && break; sleep 1; done
  fi
}

reset() {
  ensure_server
  as_pg "psql -X -q -c 'drop database if exists $DB' -c 'create database $DB'"
  as_pg "psql -X -q -c \"alter role postgres password 'postgres'\""
  as_pg "psql -X -q -d $DB -c 'create extension if not exists pgtap'"
  run_file() { as_pg "psql -v ON_ERROR_STOP=1 -q -X -d $DB -f '$PWD/$1'"; }
  run_file scripts/sql/00-supabase-stub.sql
  for f in supabase/migrations/*.sql; do run_file "$f"; done
  for f in supabase/seed/*.sql; do [ -e "$f" ] && run_file "$f"; done
  echo "local database $DB reset"
}

test_db() {
  ensure_server
  as_pg "pg_prove -d $DB --ext .sql -r '$PWD/supabase/tests/database'"
}

case "${1:-}" in
  reset) reset ;;
  test) test_db ;;
  *) echo "usage: $0 reset|test" >&2; exit 2 ;;
esac
