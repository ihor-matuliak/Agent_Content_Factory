/**
 * Client for the backend API. Base URL comes from NEXT_PUBLIC_BACKEND_URL.
 */
import type {
  Agent,
  ChatMessage,
  ChatResponse,
  Run,
  RunDetail,
  RunSize,
  SwarmEvent,
  ActivityLogEntry,
} from "@swarm/shared";

const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function fetchAgents(): Promise<Agent[]> {
  return request<Agent[]>("/api/agents");
}

export function fetchAgent(slug: string): Promise<Agent> {
  return request<Agent>(`/api/agents/${slug}`);
}

export function fetchMessages(slug: string): Promise<ChatMessage[]> {
  return request<ChatMessage[]>(`/api/agents/${slug}/messages`);
}

export function sendMessage(slug: string, message: string): Promise<ChatResponse> {
  return request<ChatResponse>(`/api/agents/${slug}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// --- Phase 4: swarm runs & events ---

export function fetchRuns(): Promise<Run[]> {
  return request<Run[]>("/api/runs");
}

export function fetchRun(id: number | string): Promise<RunDetail> {
  return request<RunDetail>(`/api/runs/${id}`);
}

export function fetchReviewRuns(): Promise<RunDetail[]> {
  return request<RunDetail[]>("/api/runs/review");
}

export function fetchRunActivity(id: number | string): Promise<ActivityLogEntry[]> {
  return request<ActivityLogEntry[]>(`/api/runs/${id}/activity`);
}

export function createRun(goal: string, size?: RunSize): Promise<Run> {
  return request<Run>("/api/runs", {
    method: "POST",
    body: JSON.stringify({ goal, size }),
  });
}

export function approvePlan(id: number | string): Promise<Run> {
  return request<Run>(`/api/runs/${id}/approve-plan`, { method: "POST" });
}

export function approveRun(id: number | string): Promise<Run> {
  return request<Run>(`/api/runs/${id}/approve`, { method: "POST" });
}

export function reviseTask(
  runId: number | string,
  taskId: number,
  feedback: string,
): Promise<Run> {
  return request<Run>(`/api/runs/${runId}/tasks/${taskId}/revise`, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
}

export function fetchEvents(): Promise<SwarmEvent[]> {
  return request<SwarmEvent[]>("/api/events");
}

export function fetchUnreadCount(): Promise<number> {
  return request<{ count: number }>("/api/events/unread-count").then((r) => r.count);
}

export function markEventsRead(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/events/read", { method: "POST" });
}
