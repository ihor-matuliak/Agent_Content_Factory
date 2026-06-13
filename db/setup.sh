#!/usr/bin/env bash
# Creates the `swarm` role and the `ai_agent_swarm` database (if they don't
# already exist), then applies schema.sql and seed.sql.
#
# Only ever touches the `swarm` role and the `ai_agent_swarm` database — no
# other database on the machine is read or modified.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

echo "==> Using psql: $PSQL"
echo "==> Connecting as superuser '$PG_SUPERUSER' to create role + database (if missing)..."

# Create the role and database only if they don't already exist. The \gexec
# meta-command runs the string produced by the preceding SELECT — so nothing
# happens when the role/database is already present.
run_superuser <<SQL
SELECT 'CREATE ROLE ${DB_ROLE} LOGIN PASSWORD ''${DB_PASS}'''
 WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_ROLE}')\gexec

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_ROLE}'
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
SQL

echo "==> Applying schema.sql..."
run_swarm -f "$DB_DIR/schema.sql"

echo "==> Applying seed.sql..."
run_swarm -f "$DB_DIR/seed.sql"

echo "==> Done. Database '${DB_NAME}' is ready (role '${DB_ROLE}')."
