/**
 * Chat handler registry.
 *
 * Maps an agent slug to the handler that produces its chat replies. Today every
 * agent talks through the shared conversational engine — each one's persona is
 * fetched from its system prompt in the database, so no per-agent code is needed.
 *
 * The registry exists as the single seam for specializing an agent later (e.g.
 * giving the Programmer tools): register a custom handler for its slug here and
 * nothing else has to change.
 */
import type { Agent, ChatResponse } from "@swarm/shared";
import { handleChat as conversationalChat } from "./conversational.js";

/** A chat handler: given an agent and a user message, return the persisted turn. */
export type ChatHandler = (
  agent: Agent,
  userMessage: string,
) => Promise<ChatResponse>;

/**
 * Per-slug overrides. Empty for now — every agent uses the shared conversational
 * handler. Add an entry here to give a specific agent custom behavior.
 */
const overrides: Record<string, ChatHandler> = {};

/** The handler used when an agent has no specific override. */
const defaultHandler: ChatHandler = conversationalChat;

/** Resolve the chat handler for an agent (override if present, else default). */
export function getChatHandler(agent: Agent): ChatHandler {
  return overrides[agent.slug] ?? defaultHandler;
}
