-- Agent Content Factory — Phase 4 migration (swarm orchestration).
--
-- SAFE / IDEMPOTENT: only CREATE ... IF NOT EXISTS. It never drops or alters
-- existing tables, so running it repeatedly cannot lose data. Apply with
-- `npm run db:migrate`.

-- runs: one swarm run = one operator goal handed to the swarm.
--   status lifecycle:
--     planning        — Strategist is breaking the goal into tasks
--     awaiting_plan   — large run: waiting for the owner to approve the plan
--     running         — executors are working through the task board
--     awaiting_review — all tasks done + summary written; waiting for the owner
--     completed       — owner approved the result
--     failed          — the run could not be completed
CREATE TABLE IF NOT EXISTS runs (
    id         SERIAL PRIMARY KEY,
    goal       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'planning',
    size       TEXT NOT NULL DEFAULT 'small',     -- 'small' | 'large'
    summary    TEXT NOT NULL DEFAULT '',
    error      TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- tasks: the task board for a run.
--   status: pending | running | needs_revision | done | failed
--   depends_on holds the ids of tasks that must be `done` before this one runs.
CREATE TABLE IF NOT EXISTS tasks (
    id             SERIAL PRIMARY KEY,
    run_id         INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    agent_slug     TEXT NOT NULL,
    description    TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    result         TEXT NOT NULL DEFAULT '',
    critic_verdict TEXT NOT NULL DEFAULT '',       -- '' | 'approved' | 'needs_revision'
    critic_comment TEXT NOT NULL DEFAULT '',
    owner_feedback TEXT NOT NULL DEFAULT '',        -- set when the owner sends a result back
    depends_on     INTEGER[] NOT NULL DEFAULT '{}',
    revision_round INTEGER NOT NULL DEFAULT 0,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_run_id ON tasks (run_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);

-- events: notification feed for the owner. Unread count drives the sidebar badge.
CREATE TABLE IF NOT EXISTS events (
    id         SERIAL PRIMARY KEY,
    run_id     INTEGER REFERENCES runs(id) ON DELETE CASCADE,
    type       TEXT NOT NULL DEFAULT 'info',
    title      TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_unread ON events (is_read, created_at DESC);

-- activity_log: who did what, per run (planning, execution, review, summary…).
CREATE TABLE IF NOT EXISTS activity_log (
    id         SERIAL PRIMARY KEY,
    run_id     INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    actor      TEXT NOT NULL,           -- agent slug, 'owner', or 'system'
    action     TEXT NOT NULL,
    detail     TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_run_id ON activity_log (run_id, created_at);
