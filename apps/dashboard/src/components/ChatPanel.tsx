"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent, ChatMessage } from "@swarm/shared";
import { fetchAgent, fetchMessages, sendMessage } from "@/lib/api";
import { Markdown } from "@/components/Markdown";

export function ChatPanel({ slug }: { slug: string }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Load agent + history on mount / slug change.
  useEffect(() => {
    let cancelled = false;
    setAgent(null);
    setMessages([]);
    setError(null);

    Promise.all([fetchAgent(slug), fetchMessages(slug)])
      .then(([a, msgs]) => {
        if (cancelled) return;
        setAgent(a);
        setMessages(msgs);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load agent");
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    setInput("");

    // Optimistically show the user's message.
    const optimistic: ChatMessage = {
      id: -Date.now(),
      agentId: agent?.id ?? 0,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const { userMessage, reply } = await sendMessage(slug, text);
      // Replace the optimistic message with the persisted pair.
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        userMessage,
        reply,
      ]);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-bold text-white">
          {(agent?.name ?? slug).slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            {agent ? agent.name : slug}
          </h2>
          {agent && <p className="text-xs text-white/50">{agent.role}</p>}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.length === 0 && !error && (
          <p className="text-sm text-white/40">
            Write the first message to start the conversation.
          </p>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white/5 px-4 py-2 text-sm text-white/50">
              Typing...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="border-t border-white/10 px-6 py-4"
      >
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend(e);
              }
            }}
            rows={1}
            placeholder={agent ? `Message ${agent.name}...` : "Message agent..."}
            className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-indigo-400/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || input.trim().length === 0}
            className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "whitespace-pre-wrap bg-indigo-500 text-sm text-white"
            : "bg-white/10 text-white/90"
        }`}
      >
        {isUser ? message.content : <Markdown>{message.content}</Markdown>}
      </div>
    </div>
  );
}
