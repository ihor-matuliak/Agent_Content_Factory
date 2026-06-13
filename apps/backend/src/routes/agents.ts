/**
 * Agent routes: list agents, fetch chat history, and send a chat message.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import type { ChatRequest } from "@swarm/shared";
import { getAgentBySlug, getMessages, listAgents } from "../db.js";
import { getChatHandler } from "../agents/handlers.js";

export const agentsRouter = Router();

/** GET /api/agents — list all active agents. */
agentsRouter.get("/", async (_req: Request, res: Response) => {
  const agents = await listAgents();
  res.json(agents);
});

/** GET /api/agents/:slug — fetch a single agent. */
agentsRouter.get("/:slug", async (req: Request, res: Response) => {
  const slug = String(req.params.slug);
  const agent = await getAgentBySlug(slug);
  if (!agent) {
    res.status(404).json({ error: `Agent '${slug}' not found` });
    return;
  }
  res.json(agent);
});

/** GET /api/agents/:slug/messages — chat history for an agent. */
agentsRouter.get("/:slug/messages", async (req: Request, res: Response) => {
  const slug = String(req.params.slug);
  const agent = await getAgentBySlug(slug);
  if (!agent) {
    res.status(404).json({ error: `Agent '${slug}' not found` });
    return;
  }
  const messages = await getMessages(agent.id);
  res.json(messages);
});

/** POST /api/agents/:slug/chat — send a message and get the agent's reply. */
agentsRouter.post("/:slug/chat", async (req: Request, res: Response) => {
  const slug = String(req.params.slug);
  const agent = await getAgentBySlug(slug);
  if (!agent) {
    res.status(404).json({ error: `Agent '${slug}' not found` });
    return;
  }

  const { message } = req.body as ChatRequest;
  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Field 'message' is required and must be a non-empty string." });
    return;
  }

  try {
    const handler = getChatHandler(agent);
    const result = await handler(agent, message.trim());
    res.json(result);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error(`[chat] agent=${agent.slug} error:`, detail);
    res.status(502).json({ error: `Agent failed to reply: ${detail}` });
  }
});
