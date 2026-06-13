/**
 * The "dialogue engine" — wraps the Claude Agent SDK to give an agent a reply.
 *
 * It pulls the agent's persona (system prompt) and conversation history from the
 * database, sends the new message to Claude, persists both the user message and
 * the assistant reply, and returns them.
 *
 * Auth: the Agent SDK reads CLAUDE_CODE_OAUTH_TOKEN (preferred) or
 * ANTHROPIC_API_KEY (fallback) from the environment — both come from .env.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Agent, ChatMessage, ChatResponse } from "@swarm/shared";
import { env, hasClaudeCredential } from "../env.js";
import { getMessages, insertMessage } from "../db.js";

/**
 * Build a single prompt that carries the prior conversation plus the new
 * message. The persona itself is supplied separately via `systemPrompt`.
 */
function buildPrompt(history: ChatMessage[], userMessage: string): string {
  if (history.length === 0) {
    return userMessage;
  }

  const transcript = history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  return [
    "Below is the conversation history with the user:",
    "",
    transcript,
    "",
    "New message from the user:",
    userMessage,
    "",
    "Respond to the new message, taking into account the history above.",
  ].join("\n");
}

/** Send the prompt to Claude via the Agent SDK and return the assistant text. */
async function generateReply(
  agent: Agent,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  if (!hasClaudeCredential) {
    throw new Error(
      "No Claude credential configured. Set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY in .env.",
    );
  }

  const prompt = buildPrompt(history, userMessage);

  let finalText = "";
  let assistantText = "";

  for await (const message of query({
    prompt,
    options: {
      model: env.anthropicModel,
      systemPrompt: agent.systemPrompt,
      // Pure conversation: one turn, no tools, no filesystem settings loaded.
      maxTurns: 1,
      allowedTools: [],
      settingSources: [],
      env: { ...process.env },
    },
  })) {
    if (message.type === "assistant") {
      // Accumulate text blocks as a fallback in case no result text is produced.
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
 * Full chat turn for an agent: load history, generate a reply, persist both
 * messages, and return them.
 */
export async function handleChat(
  agent: Agent,
  userMessage: string,
): Promise<ChatResponse> {
  const history = await getMessages(agent.id);

  const reply = await generateReply(agent, history, userMessage);

  // Persist the user message first, then the assistant reply (chronological order).
  const savedUser = await insertMessage(agent.id, "user", userMessage);
  const savedReply = await insertMessage(agent.id, "assistant", reply);

  return { userMessage: savedUser, reply: savedReply };
}
