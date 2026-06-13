"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Agent } from "@swarm/shared";
import { fetchAgents } from "@/lib/api";

export default function OverviewPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents()
      .then(setAgents)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load agents"),
      );
  }, []);

  return (
    <div className="h-full overflow-y-auto p-8">
      <h2 className="text-2xl font-bold text-white">Overview</h2>
      <p className="mt-1 max-w-2xl text-sm text-white/60">
        This is the content factory dashboard. Eight AI agents manage social
        media together. Chat with any of them one-on-one under{" "}
        <Link href="/chats" className="text-indigo-300 hover:text-indigo-200">
          Chats
        </Link>
        , or hand the whole swarm a goal under{" "}
        <Link href="/runs" className="text-indigo-300 hover:text-indigo-200">
          Swarm Runs
        </Link>{" "}
        — the Strategist plans it, the team executes, and the Critic reviews.
      </p>

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          Failed to load agents: {error}
          <div className="mt-1 text-xs text-red-300/70">
            Check that the backend is running at {process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000"}.
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={`/chats/${agent.slug}`}
            className="group rounded-xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-indigo-400/40 hover:bg-white/10"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                {agent.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/60">{agent.role}</p>
            <span className="mt-4 inline-block text-sm text-indigo-300 group-hover:text-indigo-200">
              Open chat →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
