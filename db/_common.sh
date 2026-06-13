#!/usr/bin/env bash
# Shared helpers for the db/*.sh scripts.
# Locates psql, defines connection defaults, and provides run_superuser / run_swarm.
#
# Override via environment if your setup differs:
#   PGHOST            (default: localhost)
#   PGPORT            (default: 5432)
#   PG_SUPERUSER      (default: postgres)   — used only to create the role + database
#   PG_SUPERPASS      (default: empty)      — password for the superuser, if required
#
# IMPORTANT: these scripts only ever create/drop the `swarm` role and the
# `ai_agent_swarm` database. They never touch any other database on the machine.

set -euo pipefail

DB_NAME="ai_agent_swarm"
DB_ROLE="swarm"
DB_PASS="swarm"

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PG_SUPERUSER="${PG_SUPERUSER:-postgres}"
PG_SUPERPASS="${PG_SUPERPASS:-}"

# Locate the psql executable: prefer PATH, then common Windows install dirs.
find_psql() {
  if command -v psql >/dev/null 2>&1; then
    command -v psql
    return 0
  fi
  local candidate
  for candidate in \
    "/c/Program Files/PostgreSQL"/*/bin/psql.exe \
    "/c/Program Files (x86)/PostgreSQL"/*/bin/psql.exe; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

PSQL="$(find_psql)" || {
  echo "ERROR: could not find 'psql'. Install PostgreSQL or add psql to your PATH." >&2
  exit 1
}

# Directory containing this script (so we can locate the .sql files reliably).
DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run SQL as the superuser against the default 'postgres' maintenance database.
run_superuser() {
  PGPASSWORD="$PG_SUPERPASS" "$PSQL" -v ON_ERROR_STOP=1 \
    -h "$PGHOST" -p "$PGPORT" -U "$PG_SUPERUSER" -d postgres "$@"
}

# Run SQL as the swarm role against the ai_agent_swarm database.
run_swarm() {
  PGPASSWORD="$DB_PASS" "$PSQL" -v ON_ERROR_STOP=1 \
    -h "$PGHOST" -p "$PGPORT" -U "$DB_ROLE" -d "$DB_NAME" "$@"
}
