"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Run } from "@swarm/shared";
import { createRun, fetchRuns } from "@/lib/api";
import { RUN_STATUS } from "@/lib/runs";

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    fetchRuns()
      .then(setRuns)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load runs"),
      );
  };

  // Load + poll so statuses advance live while the swarm works.
  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const text = goal.trim();
    if (!text || creating) return;
    setCreating(true);
    setError(null);
    try {
      await createRun(text);
      setGoal("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create run");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <h2 className="text-2xl font-bold text-white">Swarm Runs</h2>
      <p className="mt-1 max-w-2xl text-sm text-white/60">
        Give the swarm a goal. The Strategist plans it into tasks, the executors
        do the work, the Critic reviews it, and you get a final summary to approve.
      </p>

      {/* New run */}
      <form
        onSubmit={handleCreate}
        className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4"
      >
        <label className="mb-2 block text-sm font-medium text-white/80">
          New run goal
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="e.g. Plan a 3-post Instagram launch for our new coffee blend"
            className="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-indigo-400/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating || goal.trim().length === 0}
            className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? "Starting…" : "Start run"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Runs list */}
      <div className="mt-6 space-y-3">
        {runs.length === 0 && !error && (
          <p className="text-sm text-white/40">No runs yet. Start one above.</p>
        )}

        {runs.map((run) => {
          const status = RUN_STATUS[run.status];
          return (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-indigo-400/40 hover:bg-white/10"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">#{run.id}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-white">{run.goal}</p>
              </div>
              <span className="shrink-0 text-xs text-white/40">
                {new Date(run.createdAt).toLocaleString()}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
