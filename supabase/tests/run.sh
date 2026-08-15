#!/usr/bin/env bash
# Run the schema and its RLS policies against a real Postgres.
#
# RLS cannot be reviewed by reading — a policy that is too permissive looks
# exactly like one that is correct — so this applies the migration to a
# throwaway database and executes every policy as three different callers.
#
# Needs postgresql-16 (or later) binaries on PATH. Starts its own server on a
# unix socket, so it touches nothing already running.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGROOT="${PGROOT:-/var/tmp/topten-rls}"
PORT="${PGPORT:-55432}"

# initdb refuses to run as root, which CI containers frequently are. Fall back
# to the `postgres` system user when that happens rather than failing with a
# message about privileges nobody reads.
RUNAS=""
if [ "$(id -u)" = "0" ]; then
  if id postgres >/dev/null 2>&1; then RUNAS="postgres"; else
    echo "run.sh: running as root and no postgres user to drop to" >&2; exit 1
  fi
fi
run() { if [ -n "$RUNAS" ]; then su "$RUNAS" -c "$*"; else bash -c "$*"; fi; }

cleanup() { run "$PGBIN/pg_ctl -D $PGROOT/data stop -m immediate" >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$PGROOT"
mkdir -p "$PGROOT/data" "$PGROOT/run"
[ -n "$RUNAS" ] && chown -R "$RUNAS" "$PGROOT"
chmod 750 "$PGROOT"

run "$PGBIN/initdb -U postgres -A trust -D $PGROOT/data" >/dev/null
run "$PGBIN/pg_ctl -D $PGROOT/data -o '-k $PGROOT/run -p $PORT -c listen_addresses=' -l $PGROOT/log start" >/dev/null
for _ in $(seq 1 30); do
  "$PGBIN/pg_isready" -h "$PGROOT/run" -p "$PORT" >/dev/null 2>&1 && break
  sleep 0.5
done

PSQL="$PGBIN/psql -h $PGROOT/run -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -c "create database topten_test" >/dev/null

# Order matters: the migration references auth.users, and the grants reference
# tables the migration creates.
$PSQL -d topten_test -f "$HERE/00_supabase_stub.sql" >/dev/null
for m in "$HERE"/../migrations/*.sql; do
  echo "applying $(basename "$m")"
  $PSQL -d topten_test -f "$m" >/dev/null
done
$PSQL -d topten_test -f "$HERE/01_grants.sql" >/dev/null

# The arrival check, run here for the same reason it exists at all: it is the
# file Mischa pastes into a real project, and a check nothing executes is a
# check that rots. Run BEFORE the RLS fixtures, because one of its lines is
# "this project is empty" and the fixtures are about to make that false.
echo "verify.sql:"
VERIFY_OUT="$($PGBIN/psql -h "$PGROOT/run" -p "$PORT" -U postgres -d topten_test \
  -v ON_ERROR_STOP=1 -t -A -f "$HERE/../verify.sql")"
echo "$VERIFY_OUT"
if grep -q 'FAIL' <<<"$VERIFY_OUT"; then
  echo "run.sh: verify.sql reported a failure" >&2
  exit 1
fi

# -q suppresses the notices, and the report is the point, so this one is loud.
"$PGBIN/psql" -h "$PGROOT/run" -p "$PORT" -U postgres -d topten_test \
  -v ON_ERROR_STOP=1 -t -A -f "$HERE/rls_test.sql"
