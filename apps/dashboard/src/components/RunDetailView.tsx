"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ActivityLogEntry, RunDetail, Task } from "@swarm/shared";
import { approvePlan, fetchRun, fetchRunActivity } from "@/lib/api";
import { RUN_STATUS, TASK_STATUS, runProgress } from "@/lib/runs";
import { Markdown } from "@/components/Markdown";

export function RunDetailView({ id }: { id: string }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  const load = useCallback(() => {
    Promise.all([fetchRun(id), fetchRunActivity(id)])
      .then(([r, a]) => {
        setRun(r);
        setActivity(a);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load run"),
      );
  }, [id]);

  // Poll while the run is active so the UI tracks progress live.
  useEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [load]);

  async function handleLaunch() {
    if (!run || launching) return;
    setLaunching(true);
    try {
      await approvePlan(run.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to launch run");
    } finally {
      setLaunching(false);
    }
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!run) {
    return <div className="p-8 text-sm text-white/40">Loading run…</div>;
  }

  const status = RUN_STATUS[run.status];
  const progress = Math.round(runProgress(run.tasks) * 100);

  return (
    <div className="h-full overflow-y-auto p-8">
      <Link href="/runs" className="text-sm text-indigo-300 hover:text-indigo-200">
        ← All runs
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Run #{run.id}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${status.className}`}>
              {status.label}
            </span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-white">{run.goal}</h2>
        </div>

        {run.status === "awaiting_plan" && (
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-400 disabled:opacity-40"
          >
            {launching ? "Launching…" : "Launch run"}
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-white/50">
          <span>Progress</span>
          <span>
            {run.tasks.filter((t) => t.status === "done").length}/{run.tasks.length} tasks
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Summary */}
      {run.summary && (
        <section className="mt-6 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-5">
          <h3 className="mb-2 text-sm font-semibold text-fuchsia-200">Final summary</h3>
          <Markdown>{run.summary}</Markdown>
        </section>
      )}

      {run.status === "failed" && run.error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {run.error}
        </div>
      )}

      {/* Task board */}
      <section className="mt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">
          Plan &amp; tasks
        </h3>
        <div className="space-y-3">
          {run.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
          {run.tasks.length === 0 && (
            <p className="text-sm text-white/40">
              {run.status === "planning"
                ? "The Strategist is planning the tasks…"
                : "No tasks."}
            </p>
          )}
        </div>
      </section>

      {/* Activity log */}
      {activity.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">
            Activity
          </h3>
          <ol className="space-y-1.5 border-l border-white/10 pl-4">
            {activity.map((a) => (
              <li key={a.id} className="text-xs text-white/60">
                <span className="font-medium text-white/80">{a.actor}</span> {a.action}
                {a.detail && <span className="text-white/40"> — {a.detail}</span>}
                <span className="ml-2 text-white/30">
                  {new Date(a.createdAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const status = TASK_STATUS[task.status];
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
          {task.agentSlug}
        </span>
        <div className="flex items-center gap-2">
          {task.revisionRound > 0 && (
            <span className="text-[11px] text-amber-300/80">rev {task.revisionRound}</span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${status.className}`}>
            {status.label}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm text-white/80">{task.description}</p>

      {task.result && (
        <details className="mt-3 group" open={task.status === "done"}>
          <summary className="cursor-pointer text-xs text-indigo-300 hover:text-indigo-200">
            Result
          </summary>
          <div className="mt-2 rounded-lg bg-black/20 p-3">
            <Markdown>{task.result}</Markdown>
          </div>
        </details>
      )}

      {task.criticComment && (
        <p className="mt-2 text-xs text-white/50">
          <span className="font-medium text-white/70">Critic</span>
          {task.criticVerdict === "approved" ? " ✓ approved" : " ✗ needs revision"} —{" "}
          {task.criticComment}
        </p>
      )}
    </div>
  );
}
