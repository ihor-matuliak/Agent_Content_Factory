Hi! We are going to build a project called "Agent Content Factory". Your task right now is to prepare my computer and the project working directory so that everything installs without errors moving forward.

Complete the following steps in order:

1. Create a project boilerplate in the current directory (a monorepo using npm workspaces):
   - A root package.json with the workspaces list: ["packages/*", "apps/*"] and the "engines" field: { "node": ">=20" }. The project must be private ("private": true).
   - Directories: apps/, packages/, db/.
   - A .gitignore file (at minimum, include: node_modules, .env, .next, dist, backups).
   - A .env.example file with empty configuration placeholders:
     DATABASE_URL=postgresql://swarm:swarm@localhost:5432/ai_agent_swarm
     BACKEND_PORT=4000
     NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
     CLAUDE_CODE_OAUTH_TOKEN=PequLtuO04GMwZ0d7s0KsfKAAacNBAKmLlIADzi_JmtNYH7Obxfmhhs6o4P8wptgQFS3QOU-40WjHLwDn4xQA-jzbtvQAA
     ANTHROPIC_API_KEY=
     ANTHROPIC_MODEL=claude-sonnet-4-6
     TELEGRAM_BOT_TOKEN=
     TELEGRAM_OWNER_CHAT_ID=
     SWARM_PASSWORD=
   - Copy .env.example into a .env file (this will be the local working file for secrets, which is already listed in .gitignore).
   - Initialize a git repository (git init), but do not commit anything yet.

5. Create a CLAUDE.md file — this is the "project playbook/memo" that you will read at the beginning of each session. Briefly document: what we are building (Agent Content Factory comprising 8 AI agents for managing social media), the tech stack (npm workspaces, Next.js + React + Tailwind for the dashboard, Node.js + Express + tsx for the backend, PostgreSQL, Claude Agent SDK for the agents), and note that secrets are stored strictly in .env.

---------------------------------------------------------------------------

Phase 2 — Foundation: Database, Dashboard, Backend, and the First Agent (Strategist)

Continuing the "AI Agent Swarm" project. We are now building the foundation. Explain your steps in simple terms, show what you've done, and by the end, we should see a working dashboard in the browser featuring a live chat with the Strategist agent.

Do the following:

1. Create a shared types package in packages/shared (package name @swarm/shared) using TypeScript — this is where we will extract common data types (agent, chat message, etc.).

2. PostgreSQL Database. Create a db/ folder containing the following scripts:
   - schema.sql — the database schema. For now, create the tables: agents (id, slug, name, role, system_prompt, status, is_active) and chat_messages (id, agent_id, role, content, created_at).
   - seed.sql — seed data for a single agent: Strategist (slug: strategist) with a specific personality prompt (the system prompt should describe him as an orchestrator/planner who speaks in Russian and is friendly).
   - setup.sh — creates the swarm role (password swarm) and the ai_agent_swarm database in the local PostgreSQL instance, then applies schema.sql and seed.sql. Important: do not affect or modify other databases on the machine.
   - seed.sh and reset.sh — scripts to update agent data / recreate the database from scratch.
   Add the following commands to the root package.json: db:setup, db:seed, db:reset.

3. Backend in apps/backend (package name @swarm/backend) using Node.js + Express 5 (TypeScript, running via tsx):
   - src/env.ts — reads configuration from .env.
   - src/db.ts — PostgreSQL database connection setup.
   - src/index.ts — starts the server on the port from BACKEND_PORT, includes a health check route: GET /api/health.
   - src/routes/agents.ts — provides the list of agents and chat history.
   - src/agents/conversational.ts — the "dialogue engine" built on top of the Claude Agent SDK (@anthropic-ai/claude-agent-sdk): it fetches the agent's system prompt from the database, retrieves the chat history, sends the message to Claude, and saves the response. Access Claude using CLAUDE_CODE_OAUTH_TOKEN (or ANTHROPIC_API_KEY as a fallback) and use the model defined in ANTHROPIC_MODEL.
   - Route POST /api/agents/:slug/chat — to send a message to the agent and receive a response.

4. Dashboard in apps/dashboard (package name @swarm/dashboard) using Next.js 16 + React 19 + Tailwind CSS 4 (TypeScript):
   - src/lib/api.ts — communication logic with the backend (base URL from NEXT_PUBLIC_BACKEND_URL).
   - src/components/Sidebar.tsx — sidebar menu component.
   - A root page / (overview) and a dedicated chat page for the Strategist, where users can exchange messages and the history is persisted in the database.

5. Add the following execution commands to the root package.json: dev (runs both backend and dashboard concurrently using concurrently), dev:backend, dev:dashboard, and typecheck (runs type-checking for both the backend and the dashboard).

6. Run npm install, then npm run db:setup. Explain to me how to insert the token into .env, and then execute npm run dev. Verify that http://localhost:4000/api/health responds properly and that http://localhost:3000 opens the dashboard with a fully functional chat with the Strategist. Finally, run npm run typecheck and fix any errors if they occur.

Addresses:
- Dashboard: http://localhost:3000
- Backend: http://localhost:4000
- Database: localhost:5432 (ai_agent_swarm, user: swarm, password: swarm)