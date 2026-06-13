# CLAUDE.md — Agent Content Factory (AI Agent Swarm)

> Read this at the start of every session. It is the project playbook.

## What we are building

**Agent Content Factory** — a swarm of **8 AI agents** that collaborate to manage social
media content (planning, writing, scheduling, reviewing, publishing, etc.). A web dashboard
lets a human operator chat with each agent and oversee their work.

All 8 agents are live, each speaks English and Ukrainian, and each has a distinct persona:
`strategist` (orchestrator/planner), `scriptwriter`, `reelsmaker`, `video-editor`, `designer`,
`publisher`, `programmer`, `critic` (quality gate). **Agent personalities live in `db/seed.sql`,
not in code** — edit a `system_prompt` there and re-apply with `npm run db:seed` (this upserts
agents and never touches chat history).

The swarm also runs as a team: one operator goal = one **swarm run**, where the Strategist
plans tasks, executors do the work, the Critic reviews (up to 2 auto-revision rounds), and the
Strategist writes a final summary for the owner to approve.

## Tech stack

- **Monorepo:** npm workspaces (`packages/*`, `apps/*`), Node.js >= 20.
- **Dashboard:** `apps/dashboard` (`@swarm/dashboard`) — Next.js 16 + React 19 + Tailwind CSS 4 (TypeScript). Runs on http://localhost:3000.
- **Backend:** `apps/backend` (`@swarm/backend`) — Node.js + Express 5, written in TypeScript and run with `tsx`. Runs on http://localhost:4000.
- **Shared types:** `packages/shared` (`@swarm/shared`) — common TypeScript types (agents, chat messages, runs, tasks, events, etc.).
- **Database:** PostgreSQL (local, port 5432). Database `ai_agent_swarm`, role `swarm` / password `swarm`.
- **Agents:** Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`). Auth via `CLAUDE_CODE_OAUTH_TOKEN` (fallback `ANTHROPIC_API_KEY`). Model from `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`).
- **Run tools:** executor agents get in-process MCP tools (zod-defined via the SDK's `createSdkMcpServer`) scoped to each run/task.
- **Notifications (optional):** Telegram via `TELEGRAM_BOT_TOKEN` + `TELEGRAM_OWNER_CHAT_ID` (no-op when unset).

## Layout

```
apps/
  backend/     @swarm/backend  — Express API + agent engine
    src/agents/  conversational.ts, handlers.ts (chat registry),
                 orchestrator.ts (run engine), queue.ts (background worker),
                 tools.ts (run MCP tools), llm.ts (single-turn SDK call)
    src/routes/  agents.ts, runs.ts, events.ts
    src/         db.ts, journal.ts (activity log + event feed), notify.ts, env.ts
  dashboard/   @swarm/dashboard — Next.js operator UI
    src/app/     /, /chats, /chats/[agentId], /runs, /runs/[id], /review
packages/
  shared/      @swarm/shared   — shared TS types
db/            schema.sql, seed.sql, migrate.sql, setup.sh, seed.sh, migrate.sh, reset.sh
.env           local secrets (gitignored) — copied from .env.example
```

**Swarm run lifecycle:** `planning` → (`awaiting_plan` if large, owner clicks Launch) →
`running` → `awaiting_review` (owner approves or sends a result back) → `completed`.
Executors = all active agents except `strategist` and `critic`. The queue worker is a single
in-process loop; state lives in the DB so unfinished runs resume on restart. **Run exactly one
backend** — there is no cross-process lock, so two backends would double-process a run.

## Secrets

**Secrets live strictly in `.env`** (gitignored). Never commit secrets, never hardcode them
in source. `.env.example` holds only placeholder/blank values and is the template. Code reads
config through `apps/backend/src/env.ts` (backend) and `NEXT_PUBLIC_*` vars (dashboard).

## Common commands (from repo root)

| Command | What it does |
|---|---|
| `npm install` | Install all workspace dependencies |
| `npm run db:setup` | Create role + database, apply schema.sql + seed.sql |
| `npm run db:seed` | Re-apply seed data (agent personas; keeps chat history) |
| `npm run db:migrate` | Apply `db/migrate.sql` (safe, idempotent — Phase 4 tables) |
| `npm run db:reset` | Drop and recreate the database from scratch |
| `npm run dev` | Run backend + dashboard together (concurrently) |
| `npm run dev:backend` | Run only the backend |
| `npm run dev:dashboard` | Run only the dashboard |
| `npm run typecheck` | Type-check backend + dashboard |
| `npm run telegram:chat-id` | Print Telegram chat id(s) for `TELEGRAM_OWNER_CHAT_ID` |

## Endpoints

- Dashboard: http://localhost:3000
- Backend health: http://localhost:4000/api/health

Agents / chat:
- Agents list: `GET /api/agents`
- Chat history: `GET /api/agents/:slug/messages`
- Send message: `POST /api/agents/:slug/chat`

Swarm runs:
- List / start run: `GET /api/runs` · `POST /api/runs` (`{ goal, size? }`)
- Run detail (with tasks): `GET /api/runs/:id` · activity: `GET /api/runs/:id/activity`
- Runs awaiting review: `GET /api/runs/review`
- Launch a large run: `POST /api/runs/:id/approve-plan`
- Approve finished run: `POST /api/runs/:id/approve`
- Send a result back: `POST /api/runs/:id/tasks/:taskId/revise` (`{ feedback }`)

Notifications:
- Feed: `GET /api/events` · unread badge: `GET /api/events/unread-count` · mark read: `POST /api/events/read`
