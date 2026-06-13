"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Agent } from "@swarm/shared";
import { fetchAgents, fetchUnreadCount } from "@/lib/api";

export function Sidebar() {
  const pathname = usePathname();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetchAgents()
      .then(setAgents)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load agents"),
      );
  }, []);

  // Poll the unread notification count for the sidebar badge.
  useEffect(() => {
    let active = true;
    const load = () => {
      fetchUnreadCount()
        .then((n) => active && setUnread(n))
        .catch(() => {
          /* ignore — badge is best-effort */
        });
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/10 bg-[#0d1326] p-4">
      <div className="mb-6">
        <Link href="/" className="block">
          <h1 className="text-lg font-bold tracking-tight text-white">
            Agent Content Factory
          </h1>
          <p className="text-xs text-white/50">AI Agent Swarm</p>
        </Link>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        <NavItem href="/" label="Overview" active={pathname === "/"} />
        <NavItem href="/chats" label="Chats" active={pathname === "/chats"} />
        <NavItem
          href="/runs"
          label="Swarm Runs"
          active={pathname === "/runs" || pathname.startsWith("/runs/")}
        />
        <NavItem
          href="/review"
          label="In Review"
          active={pathname === "/review"}
          badge={unread > 0 ? unread : undefined}
        />

        <div className="mt-4 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Agents
        </div>

        {error && <p className="px-3 text-xs text-red-400">⚠ {error}</p>}

        {!error && agents.length === 0 && (
          <p className="px-3 text-xs text-white/40">Loading...</p>
        )}

        {agents.map((agent) => {
          const href = `/chats/${agent.slug}`;
          return (
            <NavItem
              key={agent.id}
              href={href}
              label={agent.name}
              sublabel={agent.role}
              active={pathname === href}
            />
          );
        })}
      </nav>

      <div className="mt-auto pt-4 text-[11px] text-white/30">v0.1 · Phase 4</div>
    </aside>
  );
}

function NavItem({
  href,
  label,
  sublabel,
  active,
  badge,
}: {
  href: string;
  label: string;
  sublabel?: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-indigo-500/20 text-white"
          : "text-white/70 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {sublabel && (
          <span className="block truncate text-[11px] text-white/40">{sublabel}</span>
        )}
      </span>
      {badge !== undefined && (
        <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
