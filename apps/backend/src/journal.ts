/**
 * Swarm journal: the activity log and the owner-facing notification feed.
 *
 * - activity_log answers "who did what" during a run (planning, execution,
 *   Critic review, summary, owner actions).
 * - events is the notification feed shown in the dashboard; the unread count
 *   drives the sidebar badge. Notable events also fan out to Telegram.
 */
import type { ActivityLogEntry, SwarmEvent } from "@swarm/shared";
import { query } from "./db.js";
import { notifyOwner } from "./notify.js";

interface ActivityRow {
  id: number;
  run_id: number;
  actor: string;
  action: string;
  detail: string;
  created_at: Date;
}

interface EventRow {
  id: number;
  run_id: number | null;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: Date;
}

function mapActivity(row: ActivityRow): ActivityLogEntry {
  return {
    id: row.id,
    runId: row.run_id,
    actor: row.actor,
    action: row.action,
    detail: row.detail,
    createdAt: row.created_at.toISOString(),
  };
}

function mapEvent(row: EventRow): SwarmEvent {
  return {
    id: row.id,
    runId: row.run_id,
    type: row.type,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    createdAt: row.created_at.toISOString(),
  };
}

// --- Activity log ---------------------------------------------------------

/** Record one activity-log entry. Never throws — logging must not break a run. */
export async function logActivity(
  runId: number,
  actor: string,
  action: string,
  detail = "",
): Promise<void> {
  try {
    await query(
      `INSERT INTO activity_log (run_id, actor, action, detail)
       VALUES ($1, $2, $3, $4)`,
      [runId, actor, action, detail],
    );
  } catch (err) {
    console.error("[journal] failed to log activity:", err);
  }
}

export async function getActivityForRun(runId: number): Promise<ActivityLogEntry[]> {
  const rows = await query<ActivityRow>(
    "SELECT * FROM activity_log WHERE run_id = $1 ORDER BY created_at, id",
    [runId],
  );
  return rows.map(mapActivity);
}

// --- Notification feed ----------------------------------------------------

/**
 * Add a notification for the owner and, when configured, push it to Telegram.
 * `notify: false` skips the Telegram fan-out (used for low-signal events).
 */
export async function addEvent(input: {
  runId?: number | null;
  type?: string;
  title: string;
  body?: string;
  notify?: boolean;
}): Promise<SwarmEvent> {
  const rows = await query<EventRow>(
    `INSERT INTO events (run_id, type, title, body)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.runId ?? null, input.type ?? "info", input.title, input.body ?? ""],
  );
  const event = mapEvent(rows[0]);

  if (input.notify !== false) {
    void notifyOwner(event.title, event.body);
  }
  return event;
}

export async function listEvents(limit = 50): Promise<SwarmEvent[]> {
  const rows = await query<EventRow>(
    "SELECT * FROM events ORDER BY created_at DESC, id DESC LIMIT $1",
    [limit],
  );
  return rows.map(mapEvent);
}

export async function countUnreadEvents(): Promise<number> {
  const rows = await query<{ count: string }>(
    "SELECT COUNT(*)::int AS count FROM events WHERE is_read = FALSE",
  );
  return Number(rows[0]?.count ?? 0);
}

/** Mark every event read (clears the sidebar badge). */
export async function markAllEventsRead(): Promise<void> {
  await query("UPDATE events SET is_read = TRUE WHERE is_read = FALSE");
}
