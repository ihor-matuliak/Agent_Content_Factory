import type { RunStatus, TaskStatus } from "@swarm/shared";

/** Human-friendly label + badge classes for a run status. */
export const RUN_STATUS: Record<RunStatus, { label: string; className: string }> = {
  planning: { label: "Planning", className: "bg-sky-500/15 text-sky-300" },
  awaiting_plan: {
    label: "Awaiting plan approval",
    className: "bg-amber-500/15 text-amber-300",
  },
  running: { label: "Running", className: "bg-indigo-500/15 text-indigo-300" },
  awaiting_review: {
    label: "Under your review",
    className: "bg-fuchsia-500/15 text-fuchsia-300",
  },
  completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-300" },
  failed: { label: "Failed", className: "bg-rose-500/15 text-rose-300" },
};

/** Human-friendly label + badge classes for a task status. */
export const TASK_STATUS: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-white/10 text-white/60" },
  running: { label: "Running", className: "bg-indigo-500/15 text-indigo-300" },
  needs_revision: {
    label: "Needs revision",
    className: "bg-amber-500/15 text-amber-300",
  },
  done: { label: "Done", className: "bg-emerald-500/15 text-emerald-300" },
  failed: { label: "Failed", className: "bg-rose-500/15 text-rose-300" },
};

/** Fraction (0–1) of a run's tasks that are done. */
export function runProgress(tasks: { status: TaskStatus }[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "done").length;
  return done / tasks.length;
}
