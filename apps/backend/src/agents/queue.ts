/**
 * Background queue for swarm runs.
 *
 * A single in-process worker loop drives every run forward without blocking the
 * HTTP server. All state lives in the database, so the worker is fully
 * crash-safe: on startup it requeues any task left mid-flight, and it discovers
 * outstanding work purely by querying run/task status. That means an
 * interrupted run is automatically picked up again when the backend restarts.
 *
 * One "tick" performs at most one unit of work (plan a run, run+review a task,
 * or summarize a finished run) and returns whether it did anything. The loop
 * ticks continuously while there is work and idles between polls otherwise.
 */
import {
  getNextRunnableTask,
  getRunsByStatus,
  getTasksForRun,
  requeueStuckTasks,
} from "../db.js";
import { logActivity } from "../journal.js";
import { executeAndReviewTask, planRun, summarizeRun } from "./orchestrator.js";

const IDLE_POLL_MS = 2000;

let started = false;
let stopping = false;

/** Do at most one unit of work. Returns true if something was processed. */
async function tick(): Promise<boolean> {
  // 1. Any run still being planned?
  const [planning] = await getRunsByStatus("planning");
  if (planning) {
    await planRun(planning);
    return true;
  }

  // 2. Any running run with actionable work?
  const running = await getRunsByStatus("running");
  for (const run of running) {
    const task = await getNextRunnableTask(run.id);
    if (task) {
      await executeAndReviewTask(run, task);
      return true;
    }

    // No runnable task: if every task is done, write the summary.
    const tasks = await getTasksForRun(run.id);
    const allDone = tasks.length > 0 && tasks.every((t) => t.status === "done");
    if (allDone) {
      await summarizeRun(run);
      return true;
    }
    // Otherwise this run is waiting on something we can't act on right now
    // (e.g. a failed task already failed the run) — fall through.
  }

  return false;
}

/** The continuous worker loop. Runs until stop() is called. */
async function loop(): Promise<void> {
  while (!stopping) {
    let did = false;
    try {
      did = await tick();
    } catch (err) {
      console.error("[queue] tick error:", err);
    }
    if (!did) {
      await new Promise((r) => setTimeout(r, IDLE_POLL_MS));
    }
  }
}

/**
 * Start the worker. Safe to call once at startup. Recovers any task left in
 * 'running' by a previous crash before beginning the loop.
 */
export async function startQueue(): Promise<void> {
  if (started) return;
  started = true;

  try {
    const requeued = await requeueStuckTasks();
    if (requeued > 0) {
      console.log(`[queue] requeued ${requeued} task(s) interrupted by a restart`);
      // Note the recovery on each affected run's journal.
      for (const run of await getRunsByStatus("running")) {
        await logActivity(run.id, "system", "resumed after restart", "");
      }
    }
  } catch (err) {
    console.error("[queue] startup recovery failed:", err);
  }

  console.log("[queue] worker started");
  void loop();
}

/** Stop the worker loop (used on graceful shutdown). */
export function stopQueue(): void {
  stopping = true;
}
