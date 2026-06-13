#!/usr/bin/env bash
# Applies db/migrate.sql to the existing ai_agent_swarm database.
# Safe to run repeatedly — migrate.sql only creates tables IF NOT EXISTS, so it
# never drops or overwrites existing data.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

echo "==> Migrating database '${DB_NAME}'..."
run_swarm -f "$DB_DIR/migrate.sql"
echo "==> Migration complete."
