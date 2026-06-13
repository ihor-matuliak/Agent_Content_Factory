/**
 * Agent "hands" during a swarm run.
 *
 * Each task execution gets its own in-process MCP server (built with the Claude
 * Agent SDK's `createSdkMcpServer` + `tool`, schemas defined with zod) bound to a
 * specific run and task. The tools let an executing agent write to the run
 * journal and pull the context it needs, without giving it filesystem or network
 * access.
 *
 * Tools are exposed to a query under the server name "swarm", so their fully
 * qualified names are `mcp__swarm__<tool>`.
 */
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { getTask } from "../db.js";
import { logActivity } from "../journal.js";

export const SWARM_MCP_SERVER_NAME = "swarm";

/** Fully qualified tool names to pass to `allowedTools`. */
export const SWARM_TOOL_NAMES = [
  `mcp__${SWARM_MCP_SERVER_NAME}__log_progress`,
  `mcp__${SWARM_MCP_SERVER_NAME}__get_context`,
] as const;

/**
 * Build an MCP server scoped to one run/task. The agent slug is recorded as the
 * actor for anything the tools write to the journal.
 */
export function createRunMcpServer(runId: number, taskId: number, agentSlug: string) {
  return createSdkMcpServer({
    name: SWARM_MCP_SERVER_NAME,
    version: "1.0.0",
    instructions:
      "Tools for working inside a swarm run. Use log_progress to note what you " +
      "are doing, and get_context to retrieve the goal and any dependency results.",
    tools: [
      tool(
        "log_progress",
        "Record a short progress note to the run's activity journal so the owner can follow along.",
        { note: z.string().min(1).describe("A brief progress note (one sentence).") },
        async (args) => {
          await logActivity(runId, agentSlug, "progress", args.note);
          return { content: [{ type: "text", text: "Logged." }] };
        },
      ),
      tool(
        "get_context",
        "Get this task's description and the results of the tasks it depends on.",
        {},
        async () => {
          const task = await getTask(taskId);
          if (!task) {
            return { content: [{ type: "text", text: "Task not found." }] };
          }
          const deps = await Promise.all(task.dependsOn.map((id) => getTask(id)));
          const depText = deps
            .filter((d): d is NonNullable<typeof d> => d !== null)
            .map((d) => `### ${d.agentSlug}: ${d.description}\n${d.result || "(no result)"}`)
            .join("\n\n");

          const text = [
            `Task: ${task.description}`,
            depText ? `\nDependency results:\n${depText}` : "\n(no dependencies)",
          ].join("\n");

          return { content: [{ type: "text", text }] };
        },
      ),
    ],
  });
}
