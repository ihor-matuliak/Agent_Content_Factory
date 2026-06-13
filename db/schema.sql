-- Agent Content Factory — database schema.
-- Applied against the ai_agent_swarm database only.

-- Agents: one row per AI agent in the swarm.
CREATE TABLE IF NOT EXISTS agents (
    id            SERIAL PRIMARY KEY,
    slug          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT '',
    system_prompt TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'idle',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

-- Chat messages: the conversation history between the operator and each agent.
CREATE TABLE IF NOT EXISTS chat_messages (
    id         SERIAL PRIMARY KEY,
    agent_id   INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_id_created_at
    ON chat_messages (agent_id, created_at);
