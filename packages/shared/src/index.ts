/**
 * @swarm/shared — common data types shared between the backend and the dashboard.
 */

/** Lifecycle / availability status of an agent. */
export type AgentStatus = "idle" | "working" | "error" | "offline";

/** A single AI agent in the swarm (e.g. the Strategist). */
export interface Agent {
  id: number;
  /** URL-safe unique identifier, e.g. "strategist". */
  slug: string;
  /** Human-readable display name. */
  name: string;
  /** Short description of the agent's role in the swarm. */
  role: string;
  /** The agent's personality / behavior instructions for Claude. */
  systemPrompt: string;
  status: AgentStatus;
  isActive: boolean;
}

/** Who authored a chat message. */
export type ChatRole = "user" | "assistant";

/** A single message in an agent's conversation. */
export interface ChatMessage {
  id: number;
  agentId: number;
  role: ChatRole;
  content: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** Request body for POST /api/agents/:slug/chat. */
export interface ChatRequest {
  message: string;
}

/** Response body for POST /api/agents/:slug/chat. */
export interface ChatResponse {
  /** The user message as persisted. */
  userMessage: ChatMessage;
  /** The agent's reply as persisted. */
  reply: ChatMessage;
}

/** Standard error envelope returned by the backend. */
export interface ApiError {
  error: string;
}

// --- Phase 4: swarm orchestration ---

/** Lifecycle status of a swarm run. */
export type RunStatus =
  | "planning"
  | "awaiting_plan"
  | "running"
  | "awaiting_review"
  | "completed"
  | "failed";

/** Whether a run auto-starts ("small") or needs plan approval ("large"). */
export type RunSize = "small" | "large";

/** A swarm run: one operator goal handed to the agent swarm. */
export interface Run {
  id: number;
  goal: string;
  status: RunStatus;
  size: RunSize;
  summary: string;
  error: string;
  createdAt: string;
  updatedAt: string;
}

/** Status of a single task on a run's task board. */
export type TaskStatus =
  | "pending"
  | "running"
  | "needs_revision"
  | "done"
  | "failed";

/** The Critic's verdict on a task result. */
export type CriticVerdict = "" | "approved" | "needs_revision";

/** A single task assigned to an executor agent within a run. */
export interface Task {
  id: number;
  runId: number;
  agentSlug: string;
  description: string;
  status: TaskStatus;
  result: string;
  criticVerdict: CriticVerdict;
  criticComment: string;
  ownerFeedback: string;
  /** Ids of tasks that must be `done` before this task can run. */
  dependsOn: number[];
  revisionRound: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** A run plus its task board — returned by the run detail endpoint. */
export interface RunDetail extends Run {
  tasks: Task[];
}

/** A notification feed item for the owner. */
export interface SwarmEvent {
  id: number;
  runId: number | null;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

/** A single activity-log entry: who did what during a run. */
export interface ActivityLogEntry {
  id: number;
  runId: number;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
}

/** Request body for POST /api/runs (start a run). */
export interface CreateRunRequest {
  goal: string;
  /** Optional explicit size override; otherwise inferred from the plan. */
  size?: RunSize;
}

/** Request body for POST /api/runs/:id/tasks/:taskId/revise. */
export interface ReviseTaskRequest {
  feedback: string;
}
