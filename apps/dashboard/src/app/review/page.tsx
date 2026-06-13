"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RunDetail, Task } from "@swarm/shared";
import {
  approveRun,
  fetchReviewRuns,
  markEventsRead,
  reviseTask,
} from "@/lib/api";
import { Markdown } from "@/components/Markdown";

export default function ReviewPage() {
  const [runs, setRuns] = useState<RunDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetchReviewRuns()
      .then(setRuns)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load review queue"),
      );
  };

  useEffect(() => {
    load();
    // Opening the review queue clears the notification badge.
    markEventsRead().catch(() => {});
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  async function handleApprove(runId: number) {
    setBusy(true);
    setError(null);
    try {
      await approveRun(runId);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve run");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevise(runId: number, taskId: number, feedback: string) {
    setBusy(true);
    setError(null);
    try {
      await reviseTask(runId, taskId, feedback);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send back for revision");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <h2 className="text-2xl font-bold text-white">In Review</h2>
      <p className="mt-1 max-w-2xl text-sm text-white/60">
        Finished runs waiting for your sign-off. Approve to complete, or send a
        specific result back to the swarm with a note for revision.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {runs.length === 0 && !error && (
        <p className="mt-6 text-sm text-white/40">
          Nothing to review right now. Start a run from{" "}
          <Link href="/runs" className="text-indigo-300 hover:text-indigo-200">
            Swarm Runs
          </Link>
          .
        </p>
      )}

      <div className="mt-6 space-y-8">
        {runs.map((run) => (
          <section
            key={run.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs text-white/40">Run #{run.id}</span>
                <h3 className="text-lg font-semibold text-white">{run.goal}</h3>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/runs/${run.id}`}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
                >
                  Open
                </Link>
                <button
                  onClick={() => handleApprove(run.id)}
                  disabled={busy}
                  className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-400 disabled:opacity-40"
                >
                  Approve run
                </button>
              </div>
            </div>

            {run.summary && (
              <div className="mt-4 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-4">
                <h4 className="mb-2 text-sm font-semibold text-fuchsia-200">Summary</h4>
                <Markdown>{run.summary}</Markdown>
              </div>
            )}

            <div className="mt-5 space-y-4">
              {run.tasks.map((task) => (
                <ReviewTask
                  key={task.id}
                  task={task}
                  busy={busy}
                  onRevise={(feedback) => handleRevise(run.id, task.id, feedback)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ReviewTask({
  task,
  busy,
  onRevise,
}: {
  task: Task;
  busy: boolean;
  onRevise: (feedback: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
          {task.agentSlug}
        </span>
        {task.revisionRound > 0 && (
          <span className="text-[11px] text-amber-300/80">rev {task.revisionRound}</span>
        )}
      </div>
      <p className="mt-2 text-sm font-medium text-white/80">{task.description}</p>

      {task.result && (
        <div className="mt-2 rounded-lg bg-white/5 p-3">
          <Markdown>{task.result}</Markdown>
        </div>
      )}

      <div className="mt-3">
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-amber-300 hover:text-amber-200"
          >
            Send back for revision
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2}
              placeholder="What should be changed?"
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-amber-400/50 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (feedback.trim()) onRevise(feedback.trim());
                  setOpen(false);
                  setFeedback("");
                }}
                disabled={busy || feedback.trim().length === 0}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-400 disabled:opacity-40"
              >
                Send back
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setFeedback("");
                }}
                className="rounded-lg px-3 py-1.5 text-xs text-white/60 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
