/**
 * Swarm run engine.
 *
 * Lifecycle of a run:
 *   plan (Strategist breaks the goal into tasks)
 *     -> small run: execute immediately
 *     -> large run: wait for the owner to approve the plan, then execute
 *   execute each task (executor agent) with up to 2 auto-revision rounds gated
 *     by the Critic
 *   summarize (Strategist writes the final summary for the owner)
 *   -> awaiting_review -> owner approves (completed) or sends a result back.
 *
 * The background queue (queue.ts) drives these steps; this module contains the
 * logic for each one plus the owner-facing actions (approve plan / approve run /
 * send a result back for revision).
 */
import type { Agent, Run, RunSize, Task, CriticVerdict } from "@swarm/shared";
import {
  bumpTaskRevision,
  createRun,
  createTask,
  failRun,
  getAgentBySlug,
  getRun,
  getTask,
  getTasksForRun,
  listAgents,
  setRunSize,
  setRunSummary,
  setTaskCritic,
  setTaskDependsOn,
  setTaskOwnerFeedback,
  setTaskResult,
  setTaskStatus,
  updateRunStatus,
} from "../db.js";
import { addEvent, logActivity } from "../journal.js";
import { runAgentTurn, extractJson } from "./llm.js";
import { createRunMcpServer, SWARM_MCP_SERVER_NAME, SWARM_TOOL_NAMES } from "./tools.js";

/** Agents that never act as executors — they orchestrate and review. */
const NON_EXECUTOR_SLUGS = new Set(["strategist", "critic"]);

/** Tasks beyond this count make a run "large" (needs plan approval). */
const SMALL_RUN_TASK_LIMIT = 2;

/** Maximum Critic-driven auto-revision rounds per task. */
const MAX_AUTO_REVISIONS = 2;

interface PlannedTask {
  agent: string;
  description: string;
  depends_on: number[];
}

// --- Helpers --------------------------------------------------------------

async function getExecutorAgents(): Promise<Agent[]> {
  const agents = await listAgents();
  return agents.filter((a) => !NON_EXECUTOR_SLUGS.has(a.slug));
}

async function requireAgent(slug: string): Promise<Agent> {
  const agent = await getAgentBySlug(slug);
  if (!agent) throw new Error(`Agent '${slug}' not found`);
  return agent;
}

// --- Start a run ----------------------------------------------------------

/**
 * Create a run and kick off planning. The queue picks it up from the
 * 'planning' status — this returns as soon as the row exists.
 */
export async function startRun(goal: string, sizeOverride?: RunSize): Promise<Run> {
  const run = await createRun(goal, sizeOverride ?? "small");
  await logActivity(run.id, "owner", "created run", goal);
  await addEvent({
    runId: run.id,
    type: "run_created",
    title: "New swarm run created",
    body: goal,
    notify: false,
  });
  return run;
}

// --- Planning -------------------------------------------------------------

/** Strategist breaks the goal into a task board, then we set the run going. */
export async function planRun(run: Run): Promise<void> {
  const strategist = await requireAgent("strategist");
  const executors = await getExecutorAgents();
  const roster = executors.map((a) => `- ${a.slug}: ${a.role}`).join("\n");

  const prompt = [
    "You are planning a swarm run. Break the GOAL into a small number of concrete tasks,",
    "each assigned to exactly ONE executor agent.",
    "",
    "GOAL:",
    run.goal,
    "",
    "AVAILABLE EXECUTOR AGENTS (use only these slugs):",
    roster,
    "",
    "Rules:",
    "- Use between 1 and 6 tasks. Prefer the fewest that genuinely accomplish the goal.",
    "- Each task has: the agent slug, a clear self-contained instruction, and depends_on:",
    "  the 0-based indices of earlier tasks whose output it needs (empty if none).",
    "- Order tasks so that dependencies always come before the tasks that need them.",
    "",
    "Output ONLY JSON (no prose, no code fence is required) in exactly this shape:",
    '[{"agent":"scriptwriter","description":"...","depends_on":[]},',
    ' {"agent":"video-editor","description":"...","depends_on":[0]}]',
  ].join("\n");

  let planned: PlannedTask[];
  try {
    const raw = await runAgentTurn({ systemPrompt: strategist.systemPrompt, prompt });
    planned = extractJson<PlannedTask[]>(raw);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await failRun(run.id, `Planning failed: ${detail}`);
    await logActivity(run.id, "strategist", "planning failed", detail);
    await addEvent({
      runId: run.id,
      type: "run_failed",
      title: "Swarm run failed during planning",
      body: detail,
    });
    return;
  }

  const validSlugs = new Set(executors.map((a) => a.slug));
  const clean = (Array.isArray(planned) ? planned : [])
    .filter((t) => t && typeof t.description === "string" && validSlugs.has(t.agent))
    .slice(0, 6);

  if (clean.length === 0) {
    await failRun(run.id, "Planner produced no valid tasks.");
    await logActivity(run.id, "strategist", "planning failed", "no valid tasks");
    await addEvent({
      runId: run.id,
      type: "run_failed",
      title: "Swarm run failed: empty plan",
      body: run.goal,
    });
    return;
  }

  // Insert tasks, then resolve depends_on indices -> real task ids.
  const created: Task[] = [];
  for (let i = 0; i < clean.length; i++) {
    const task = await createTask({
      runId: run.id,
      agentSlug: clean[i].agent,
      description: clean[i].description,
      dependsOn: [],
      sortOrder: i,
    });
    created.push(task);
  }
  for (let i = 0; i < clean.length; i++) {
    const deps = (clean[i].depends_on ?? [])
      .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < i)
      .map((idx) => created[idx].id);
    if (deps.length > 0) {
      await setTaskDependsOn(created[i].id, deps);
    }
  }

  await logActivity(
    run.id,
    "strategist",
    "planned run",
    `${clean.length} task(s): ` + clean.map((t) => `${t.agent}`).join(", "),
  );

  // Decide size. A genuinely big plan (> limit tasks) always needs approval.
  // For a small plan, honor the run's stored size — 'large' when the owner
  // explicitly asked to gate it, otherwise 'small' to auto-start.
  const size: RunSize = clean.length > SMALL_RUN_TASK_LIMIT ? "large" : run.size;
  await setRunSize(run.id, size);

  if (size === "large") {
    await updateRunStatus(run.id, "awaiting_plan");
    await addEvent({
      runId: run.id,
      type: "plan_ready",
      title: "Plan ready — review & launch",
      body: `The Strategist planned ${clean.length} tasks for: ${run.goal}`,
    });
  } else {
    await updateRunStatus(run.id, "running");
    await addEvent({
      runId: run.id,
      type: "run_started",
      title: "Swarm run started",
      body: run.goal,
      notify: false,
    });
  }
}

/** Owner approves a large run's plan: start executing. */
export async function approvePlan(runId: number): Promise<Run | null> {
  const run = await getRun(runId);
  if (!run || run.status !== "awaiting_plan") return run;
  await updateRunStatus(runId, "running");
  await logActivity(runId, "owner", "approved plan", "");
  await addEvent({
    runId,
    type: "run_started",
    title: "Swarm run launched",
    body: run.goal,
    notify: false,
  });
  return getRun(runId);
}

// --- Execution + Critic review -------------------------------------------

/** Run a single task to completion: execute, then up to 2 Critic-gated rounds. */
export async function executeAndReviewTask(run: Run, taskInput: Task): Promise<void> {
  // Re-fetch for the latest owner feedback / revision round.
  const task = (await getTask(taskInput.id)) ?? taskInput;
  const agent = await requireAgent(task.agentSlug);

  await setTaskStatus(task.id, "running");
  await logActivity(run.id, task.agentSlug, "started task", task.description);

  let comment = "";
  let verdict: CriticVerdict = "";

  try {
    for (let attempt = 0; attempt <= MAX_AUTO_REVISIONS; attempt++) {
      const result = await executeTask(run, task, agent, comment, attempt > 0);
      await setTaskResult(task.id, result);
      if (attempt > 0) await bumpTaskRevision(task.id);

      const review = await reviewTask(run, task, agent.name, result);
      verdict = review.verdict;
      comment = review.comment;
      await setTaskCritic(task.id, verdict, comment);
      await logActivity(
        run.id,
        "critic",
        verdict === "approved" ? "approved result" : "requested revision",
        comment,
      );

      if (verdict === "approved") break;
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await setTaskStatus(task.id, "failed");
    await failRun(run.id, `Task ${task.id} failed: ${detail}`);
    await logActivity(run.id, task.agentSlug, "task failed", detail);
    await addEvent({
      runId: run.id,
      type: "run_failed",
      title: "Swarm run failed",
      body: `Task "${task.description}" failed: ${detail}`,
    });
    return;
  }

  await setTaskStatus(task.id, "done");
  await logActivity(run.id, task.agentSlug, "completed task", "");
}

/** Build the execution prompt, run the agent (with run tools), return the deliverable. */
async function executeTask(
  run: Run,
  task: Task,
  agent: Agent,
  criticComment: string,
  isRevision: boolean,
): Promise<string> {
  const deps = await Promise.all(task.dependsOn.map((id) => getTask(id)));
  const depBlock = deps
    .filter((d): d is Task => d !== null)
    .map((d) => `### From ${d.agentSlug} — ${d.description}\n${d.result || "(no result)"}`)
    .join("\n\n");

  const parts = [
    `You are working on one task in a swarm run toward this GOAL:`,
    run.goal,
    "",
    "YOUR TASK:",
    task.description,
  ];
  if (depBlock) {
    parts.push("", "RESULTS YOU CAN BUILD ON:", depBlock);
  }
  if (isRevision && criticComment) {
    parts.push("", `The Critic asked for changes — address them precisely:`, criticComment);
  }
  if (task.ownerFeedback) {
    parts.push("", `The owner requested these changes:`, task.ownerFeedback);
  }
  parts.push(
    "",
    "Use the log_progress tool to note key steps as you work.",
    "Produce the finished deliverable as your final message, in clean Markdown.",
    "Do not include meta commentary about the process — just the deliverable.",
  );

  return runAgentTurn({
    systemPrompt: agent.systemPrompt,
    prompt: parts.join("\n"),
    mcpServers: { [SWARM_MCP_SERVER_NAME]: createRunMcpServer(run.id, task.id, agent.slug) },
    allowedTools: [...SWARM_TOOL_NAMES],
    maxTurns: 8,
  });
}

/** Critic reviews a deliverable and returns a structured verdict. */
async function reviewTask(
  run: Run,
  task: Task,
  authorName: string,
  result: string,
): Promise<{ verdict: CriticVerdict; comment: string }> {
  const critic = await requireAgent("critic");
  const prompt = [
    `Review this deliverable produced by ${authorName}.`,
    "",
    `RUN GOAL: ${run.goal}`,
    `TASK: ${task.description}`,
    "",
    "DELIVERABLE:",
    result,
    "",
    "Decide whether it is good enough to ship to the owner. Be strict about",
    "hallucinations and unsupported claims, but do not invent problems.",
    "",
    'Output ONLY JSON: {"verdict":"approved"|"needs_revision","comment":"<short, specific>"}',
  ].join("\n");

  try {
    const raw = await runAgentTurn({ systemPrompt: critic.systemPrompt, prompt });
    const parsed = extractJson<{ verdict: string; comment?: string }>(raw);
    const verdict: CriticVerdict =
      parsed.verdict === "needs_revision" ? "needs_revision" : "approved";
    return { verdict, comment: parsed.comment ?? "" };
  } catch {
    // If the Critic's output can't be parsed, don't block the run — approve.
    return { verdict: "approved", comment: "(Critic review could not be parsed; auto-approved.)" };
  }
}

// --- Summary + owner review ----------------------------------------------

/** All tasks are done: Strategist writes the final summary; run awaits review. */
export async function summarizeRun(run: Run): Promise<void> {
  const strategist = await requireAgent("strategist");
  const tasks = await getTasksForRun(run.id);

  const resultsBlock = tasks
    .map((t) => `### ${t.agentSlug} — ${t.description}\n${t.result || "(no result)"}`)
    .join("\n\n");

  const prompt = [
    "The swarm has completed every task for this GOAL:",
    run.goal,
    "",
    "Here are the results, in order:",
    resultsBlock,
    "",
    "Write a concise final summary for the owner: what was produced, how the pieces",
    "fit together, and any caveats or follow-ups worth noting. Use clean Markdown.",
  ].join("\n");

  let summary: string;
  try {
    summary = await runAgentTurn({ systemPrompt: strategist.systemPrompt, prompt });
  } catch (err) {
    summary = `_(Summary generation failed: ${err instanceof Error ? err.message : err})_`;
  }

  await setRunSummary(run.id, summary);
  await updateRunStatus(run.id, "awaiting_review");
  await logActivity(run.id, "strategist", "wrote summary", "");
  await addEvent({
    runId: run.id,
    type: "run_review",
    title: "Swarm run complete — awaiting your review",
    body: run.goal,
  });
}

/** Owner approves the finished run. */
export async function approveRun(runId: number): Promise<Run | null> {
  const run = await getRun(runId);
  if (!run || run.status !== "awaiting_review") return run;
  await updateRunStatus(runId, "completed");
  await logActivity(runId, "owner", "approved run", "");
  await addEvent({
    runId,
    type: "run_completed",
    title: "Swarm run approved & completed",
    body: run.goal,
    notify: false,
  });
  return getRun(runId);
}

/**
 * Owner sends a single result back for revision with feedback. The task is
 * re-queued and the run goes back to running; the queue re-executes it.
 */
export async function reviseTask(
  runId: number,
  taskId: number,
  feedback: string,
): Promise<Run | null> {
  const run = await getRun(runId);
  const task = await getTask(taskId);
  if (!run || !task || task.runId !== runId) return run;

  await setTaskOwnerFeedback(taskId, feedback);
  await setTaskStatus(taskId, "needs_revision");
  await updateRunStatus(runId, "running");
  await logActivity(runId, "owner", "sent result back for revision", feedback);
  await addEvent({
    runId,
    type: "revision_requested",
    title: "You sent a result back for revision",
    body: feedback,
    notify: false,
  });
  return getRun(runId);
}
