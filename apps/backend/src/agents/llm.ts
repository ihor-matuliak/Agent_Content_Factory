/**
 * Low-level single-turn call to an agent via the Claude Agent SDK.
 *
 * Shared by the orchestrator's planning, execution, review, and summary steps.
 * Optionally wires in an in-process MCP server (the run "tools") so an executing
 * agent can use its hands during a task.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { McpServerConfig } from "@anthropic-ai/claude-agent-sdk";
import { env, hasClaudeCredential } from "../env.js";

export interface AgentTurnOptions {
  systemPrompt: string;
  prompt: string;
  /** Optional MCP servers (keyed by name) to expose to the agent. */
  mcpServers?: Record<string, McpServerConfig>;
  /** Tool names the agent may call. Defaults to none. */
  allowedTools?: string[];
  /** Max agent turns (allow a few when tools are in play). */
  maxTurns?: number;
}

/** Run one agent turn and return the assistant's final text. */
export async function runAgentTurn(options: AgentTurnOptions): Promise<string> {
  if (!hasClaudeCredential) {
    throw new Error(
      "No Claude credential configured. Set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY in .env.",
    );
  }

  let finalText = "";
  let assistantText = "";

  for await (const message of query({
    prompt: options.prompt,
    options: {
      model: env.anthropicModel,
      systemPrompt: options.systemPrompt,
      maxTurns: options.maxTurns ?? 1,
      allowedTools: options.allowedTools ?? [],
      mcpServers: options.mcpServers,
      settingSources: [],
      env: { ...process.env },
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          assistantText += block.text;
        }
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        finalText = message.result;
      } else {
        throw new Error(`Claude Agent SDK returned: ${message.subtype}`);
      }
      break;
    }
  }

  const reply = (finalText || assistantText).trim();
  if (!reply) {
    throw new Error("Claude returned an empty response.");
  }
  return reply;
}

/**
 * Pull the first JSON value (object or array) out of a model response, tolerating
 * ```json fences and surrounding prose. Throws if nothing parseable is found.
 */
export function extractJson<T>(text: string): T {
  // Strip code fences if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;

  // Find the first balanced JSON object or array.
  const start = candidate.search(/[[{]/);
  if (start === -1) {
    throw new Error("No JSON found in model response.");
  }

  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        const slice = candidate.slice(start, i + 1);
        return JSON.parse(slice) as T;
      }
    }
  }
  throw new Error("Unbalanced JSON in model response.");
}
