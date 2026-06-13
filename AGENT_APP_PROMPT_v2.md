Phase 3 — All 8 Agents as Conversation Partners

Continuing the "AI Agent Swarm" project. Now, let's add the remaining agents so that users can chat with each one individually via the "Chats" section.

Do the following:

1. Add 7 more agents to db/seed.sql, each with a unique personality (system prompt in English or Ukrainian, distinct "persona", and specific area of responsibility):
   - Scriptwriter — writes scripts for videos, reels, and posts.
   - Reelsmaker — comes up with short vertical videos.
   - Video Editor — responsible for editing and assembling videos.
   - Designer — visual branding: covers, previews, briefs.
   - Publisher — strategy and formatting of publications.
   - Programmer — helps understand and fix the swarm system.
   - Critic — reviews the output of other agents for errors and hallucinations.
   Set all is_active = TRUE. Make the prompts vibrant and distinct in tone.

2. In the backend, create a chat registry in src/agents/handlers.ts that maps an agent's slug to its handler. All agents in chat mode should use the shared conversational.ts, with their persona fetched from the system prompt in the database.

3. On the dashboard:
   - "Chats" page (/chats) — a list of all 8 agents rendered as cards.
   - Individual chat page (/chats/[agentId]) — dialogue interface with history and beautifully formatted messages (markdown).
   - Add the "Chats" section to the sidebar menu.

4. Update the agent data in the database using the command npm run db:seed (it must not erase chat history). Start the project and verify that you can chat with all 8 agents and that each responds in character. Run npm run typecheck.

5. Utilize frontend design skills to make the interface more beautiful and user-friendly.

Reminder for me: agent personalities live in db/seed.sql (not in the code), and any personality can be updated there later and re-applied using npm run db:seed.

--------------------------------------------------------------------------- 

Phase 4 — Orchestrating Agents into a Swarm

Now we will connect the agents into a swarm: one user goal = one "swarm run", where the Strategist plans and assigns tasks, the executors complete them, the Critic reviews them, and the Strategist writes the final summary.

Do the following:

1. Database. Add tables (via a safe migration file db/migrate.sql to avoid data loss, and the command npm run db:migrate):
   - runs — swarm runs (goal, status, summary).
   - tasks — task board (agent, description, status, result, Critic's verdict, task dependencies, revision round number).
   - events — notification feed for the owner (with a counter in the dashboard).
   - activity_log — journal: who did what for each run.

2. Backend — run orchestration system:
   - src/agents/orchestrator.ts — run engine: planning (Strategist breaks down the goal into tasks) → execution → Critic review (up to 2 rounds of auto-revision) → summary for the owner.
   - src/agents/queue.ts — background queue: processes tasks one by one without blocking the dashboard. If the backend restarts mid-run, unfinished tasks should be picked up upon startup.
   - src/agents/tools.ts — agents' "hands" during a run, defined via zod and the built-in MCP server of the Claude Agent SDK, tied to a specific run/task.
   - src/journal.ts — swarm activity log and notification feed.
   - Routes src/routes/runs.ts and src/routes/events.ts: start a run, check status, list tasks, approve/send back the result for revision.
   By default, all active agents except strategist and critic become executors.

3. Run status logic: a small run starts immediately; a major run enters the "waiting for plan approval" status (the owner reviews the plan and clicks "Launch"). When all tasks are completed, the status changes to "under your review".

4. Dashboard:
   - "Swarm Runs" (/runs) — list of runs and an individual run page (/runs/[id]) showing the plan, tasks, and a progress bar.
   - "In Review" (/review) — "Approve" and "Send Back for Revision" buttons (with a comment field) for each result.
   - Notification counter in the sidebar menu (fetched from the events table).

5. (Optional) Telegram notifications: src/notify.ts — a bot messages the owner when the plan is ready for launch or when the run completes. Configurations in .env (TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_CHAT_ID). Add a script to help find one's chat_id (npm run telegram:chat-id command).

6. Run npm run db:migrate, start the project, create a test run with a sample goal, and verify the entire lifecycle: plan → execution → Critic review → summary → "In Review" → approval. Finally, execute npm run typecheck.