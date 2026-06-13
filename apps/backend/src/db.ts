/**
 * PostgreSQL connection pool + small query helpers and row mappers.
 */
import pg from "pg";
import type {
  Agent,
  ChatMessage,
  Run,
  RunSize,
  RunStatus,
  Task,
  TaskStatus,
  CriticVerdict,
} from "@swarm/shared";
import { env } from "./env.js";

const { Pool } = pg;

export const pool = new Pool({ connectionString: env.databaseUrl });

/** Run a parameterized query and return the rows. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(text, params as never[]);
  return result.rows;
}

// --- Row shapes (snake_case, as stored) ---

interface AgentRow {
  id: number;
  slug: string;
  name: string;
  role: string;
  system_prompt: string;
  status: string;
  is_active: boolean;
}

interface ChatMessageRow {
  id: number;
  agent_id: number;
  role: string;
  content: string;
  created_at: Date;
}

// --- Mappers (snake_case row -> camelCase shared type) ---

export function mapAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    role: row.role,
    systemPrompt: row.system_prompt,
    status: row.status as Agent["status"],
    isActive: row.is_active,
  };
}

export function mapChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    agentId: row.agent_id,
    role: row.role as ChatMessage["role"],
    content: row.content,
    createdAt: row.created_at.toISOString(),
  };
}

// --- Data access ---

export async function listAgents(): Promise<Agent[]> {
  const rows = await query<AgentRow>(
    "SELECT * FROM agents WHERE is_active = TRUE ORDER BY id",
  );
  return rows.map(mapAgent);
}

export async function getAgentBySlug(slug: string): Promise<Agent | null> {
  const rows = await query<AgentRow>(
    "SELECT * FROM agents WHERE slug = $1",
    [slug],
  );
  return rows[0] ? mapAgent(rows[0]) : null;
}

export async function getMessages(agentId: number): Promise<ChatMessage[]> {
  const rows = await query<ChatMessageRow>(
    "SELECT * FROM chat_messages WHERE agent_id = $1 ORDER BY created_at, id",
    [agentId],
  );
  return rows.map(mapChatMessage);
}

export async function insertMessage(
  agentId: number,
  role: ChatMessage["role"],
  content: string,
): Promise<ChatMessage> {
  const rows = await query<ChatMessageRow>(
    `INSERT INTO chat_messages (agent_id, role, content)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [agentId, role, content],
  );
  return mapChatMessage(rows[0]);
}

// --- Phase 4: runs & tasks ---

interface RunRow {
  id: number;
  goal: string;
  status: string;
  size: string;
  summary: string;
  error: string;
  created_at: Date;
  updated_at: Date;
}

interface TaskRow {
  id: number;
  run_id: number;
  agent_slug: string;
  description: string;
  status: string;
  result: string;
  critic_verdict: string;
  critic_comment: string;
  owner_feedback: string;
  depends_on: number[];
  revision_round: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export function mapRun(row: RunRow): Run {
  return {
    id: row.id,
    goal: row.goal,
    status: row.status as RunStatus,
    size: row.size as RunSize,
    summary: row.summary,
    error: row.error,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    runId: row.run_id,
    agentSlug: row.agent_slug,
    description: row.description,
    status: row.status as TaskStatus,
    result: row.result,
    criticVerdict: row.critic_verdict as CriticVerdict,
    criticComment: row.critic_comment,
    ownerFeedback: row.owner_feedback,
    dependsOn: row.depends_on ?? [],
    revisionRound: row.revision_round,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// Runs ---------------------------------------------------------------------

export async function createRun(goal: string, size: RunSize): Promise<Run> {
  const rows = await query<RunRow>(
    `INSERT INTO runs (goal, size, status)
     VALUES ($1, $2, 'planning')
     RETURNING *`,
    [goal, size],
  );
  return mapRun(rows[0]);
}

export async function getRun(id: number): Promise<Run | null> {
  const rows = await query<RunRow>("SELECT * FROM runs WHERE id = $1", [id]);
  return rows[0] ? mapRun(rows[0]) : null;
}

export async function listRuns(): Promise<Run[]> {
  const rows = await query<RunRow>("SELECT * FROM runs ORDER BY created_at DESC, id DESC");
  return rows.map(mapRun);
}

export async function getRunsByStatus(status: RunStatus): Promise<Run[]> {
  const rows = await query<RunRow>(
    "SELECT * FROM runs WHERE status = $1 ORDER BY created_at, id",
    [status],
  );
  return rows.map(mapRun);
}

export async function updateRunStatus(id: number, status: RunStatus): Promise<void> {
  await query("UPDATE runs SET status = $2, updated_at = now() WHERE id = $1", [id, status]);
}

export async function setRunSize(id: number, size: RunSize): Promise<void> {
  await query("UPDATE runs SET size = $2, updated_at = now() WHERE id = $1", [id, size]);
}

export async function setRunSummary(id: number, summary: string): Promise<void> {
  await query("UPDATE runs SET summary = $2, updated_at = now() WHERE id = $1", [id, summary]);
}

export async function failRun(id: number, error: string): Promise<void> {
  await query(
    "UPDATE runs SET status = 'failed', error = $2, updated_at = now() WHERE id = $1",
    [id, error],
  );
}

// Tasks --------------------------------------------------------------------

export async function createTask(input: {
  runId: number;
  agentSlug: string;
  description: string;
  dependsOn: number[];
  sortOrder: number;
}): Promise<Task> {
  const rows = await query<TaskRow>(
    `INSERT INTO tasks (run_id, agent_slug, description, depends_on, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.runId, input.agentSlug, input.description, input.dependsOn, input.sortOrder],
  );
  return mapTask(rows[0]);
}

export async function getTask(id: number): Promise<Task | null> {
  const rows = await query<TaskRow>("SELECT * FROM tasks WHERE id = $1", [id]);
  return rows[0] ? mapTask(rows[0]) : null;
}

export async function getTasksForRun(runId: number): Promise<Task[]> {
  const rows = await query<TaskRow>(
    "SELECT * FROM tasks WHERE run_id = $1 ORDER BY sort_order, id",
    [runId],
  );
  return rows.map(mapTask);
}

export async function setTaskStatus(id: number, status: TaskStatus): Promise<void> {
  await query("UPDATE tasks SET status = $2, updated_at = now() WHERE id = $1", [id, status]);
}

export async function setTaskResult(id: number, result: string): Promise<void> {
  await query("UPDATE tasks SET result = $2, updated_at = now() WHERE id = $1", [id, result]);
}

export async function setTaskCritic(
  id: number,
  verdict: CriticVerdict,
  comment: string,
): Promise<void> {
  await query(
    "UPDATE tasks SET critic_verdict = $2, critic_comment = $3, updated_at = now() WHERE id = $1",
    [id, verdict, comment],
  );
}

export async function setTaskDependsOn(id: number, deps: number[]): Promise<void> {
  await query("UPDATE tasks SET depends_on = $2, updated_at = now() WHERE id = $1", [id, deps]);
}

export async function bumpTaskRevision(id: number): Promise<void> {
  await query(
    "UPDATE tasks SET revision_round = revision_round + 1, updated_at = now() WHERE id = $1",
    [id],
  );
}

export async function setTaskOwnerFeedback(id: number, feedback: string): Promise<void> {
  await query("UPDATE tasks SET owner_feedback = $2, updated_at = now() WHERE id = $1", [
    id,
    feedback,
  ]);
}

/**
 * The next task that is ready to run for a run: status pending/needs_revision
 * and every task it depends on is already `done`. Lowest sort_order first.
 */
export async function getNextRunnableTask(runId: number): Promise<Task | null> {
  const rows = await query<TaskRow>(
    `SELECT t.* FROM tasks t
      WHERE t.run_id = $1
        AND t.status IN ('pending', 'needs_revision')
        AND NOT EXISTS (
          SELECT 1 FROM tasks dep
           WHERE dep.id = ANY(t.depends_on)
             AND dep.status <> 'done'
        )
      ORDER BY t.sort_order, t.id
      LIMIT 1`,
    [runId],
  );
  return rows[0] ? mapTask(rows[0]) : null;
}

/** Reset tasks left in 'running' by a crash back to 'pending' so they re-run. */
export async function requeueStuckTasks(): Promise<number> {
  const rows = await query<{ id: number }>(
    "UPDATE tasks SET status = 'pending', updated_at = now() WHERE status = 'running' RETURNING id",
  );
  return rows.length;
}
