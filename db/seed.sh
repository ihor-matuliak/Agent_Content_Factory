#!/usr/bin/env bash
# Re-applies seed data (agent definitions) to the existing ai_agent_swarm database.
# Safe to run repeatedly — seed.sql upserts on the agent slug.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

echo "==> Seeding database '${DB_NAME}'..."
run_swarm -f "$DB_DIR/seed.sql"
echo "==> Seed complete."
