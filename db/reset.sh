#!/usr/bin/env bash
# Recreates the ai_agent_swarm database from scratch:
#   drops the database (terminating connections), recreates it, re-applies
#   schema.sql + seed.sql. The `swarm` role is left in place.
#
# Only the `ai_agent_swarm` database is dropped — no other database is touched.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

echo "==> Dropping and recreating database '${DB_NAME}'..."

# Terminate any open connections so DROP DATABASE can proceed.
run_superuser <<SQL
SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
 WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME} OWNER ${DB_ROLE};
SQL

echo "==> Applying schema.sql..."
run_swarm -f "$DB_DIR/schema.sql"

echo "==> Applying seed.sql..."
run_swarm -f "$DB_DIR/seed.sql"

echo "==> Reset complete. Database '${DB_NAME}' recreated."
