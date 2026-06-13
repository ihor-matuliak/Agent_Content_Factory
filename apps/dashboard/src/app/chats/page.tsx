"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Agent } from "@swarm/shared";
import { fetchAgents } from "@/lib/api";

/** Deterministic gradient per agent slug so avatars look distinct but stable. */
const GRADIENTS = [
  "from-indigo-500 to-fuchsia-500",
  "from-sky-500 to-cyan-400",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-400",
  "from-rose-500 to-pink-500",
  "from-violet-500 to-purple-500",
  "from-lime-500 to-green-500",
  "from-blue-500 to-indigo-500",
];

function gradientFor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export default function ChatsPage() {
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
      <h2 className="text-2xl font-bold text-white">Chats</h2>
      <p className="mt-1 max-w-2xl text-sm text-white/60">
        Talk to any agent in the swarm one-on-one. Each one has its own
        personality and area of expertise — pick someone to start a conversation.
      </p>

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          Failed to load agents: {error}
        </div>
      )}

      {!error && agents.length === 0 && (
        <p className="mt-6 text-sm text-white/40">Loading agents…</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={`/chats/${agent.slug}`}
            className="group flex flex-col rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:-translate-y-0.5 hover:border-indigo-400/40 hover:bg-white/10"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientFor(
                  agent.slug,
                )} text-sm font-bold text-white`}
              >
                {agent.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-white">
                  {agent.name}
                </h3>
                <span className="text-[11px] text-emerald-300">
                  ● {agent.status}
                </span>
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-white/60">{agent.role}</p>
            <span className="mt-4 inline-block text-sm text-indigo-300 group-hover:text-indigo-200">
              Open chat →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
