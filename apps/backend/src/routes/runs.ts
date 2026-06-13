/**
 * Swarm run routes: start a run, inspect status/tasks/activity, approve a plan,
 * approve a finished run, or send a single result back for revision.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import type {
  CreateRunRequest,
  ReviseTaskRequest,
  RunDetail,
} from "@swarm/shared";
import { getRun, getRunsByStatus, getTasksForRun, listRuns } from "../db.js";
import { getActivityForRun } from "../journal.js";
import {
  approvePlan,
  approveRun,
  reviseTask,
  startRun,
} from "../agents/orchestrator.js";

export const runsRouter = Router();

/** GET /api/runs — all runs, newest first. */
runsRouter.get("/", async (_req: Request, res: Response) => {
  res.json(await listRuns());
});

/** GET /api/runs/review — runs awaiting the owner's review, with their tasks. */
runsRouter.get("/review", async (_req: Request, res: Response) => {
  const runs = await getRunsByStatus("awaiting_review");
  const detailed: RunDetail[] = await Promise.all(
    runs.map(async (run) => ({ ...run, tasks: await getTasksForRun(run.id) })),
  );
  res.json(detailed);
});

/** POST /api/runs — start a new run from a goal. */
runsRouter.post("/", async (req: Request, res: Response) => {
  const { goal, size } = req.body as CreateRunRequest;
  if (typeof goal !== "string" || goal.trim().length === 0) {
    res.status(400).json({ error: "Field 'goal' is required and must be a non-empty string." });
    return;
  }
  if (size !== undefined && size !== "small" && size !== "large") {
    res.status(400).json({ error: "Field 'size' must be 'small' or 'large' when provided." });
    return;
  }
  const run = await startRun(goal.trim(), size);
  res.status(201).json(run);
});

/** GET /api/runs/:id — a run plus its task board. */
runsRouter.get("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const run = await getRun(id);
  if (!run) {
    res.status(404).json({ error: `Run ${req.params.id} not found` });
    return;
  }
  const detail: RunDetail = { ...run, tasks: await getTasksForRun(id) };
  res.json(detail);
});

/** GET /api/runs/:id/activity — the run's activity log. */
runsRouter.get("/:id/activity", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const run = await getRun(id);
  if (!run) {
    res.status(404).json({ error: `Run ${req.params.id} not found` });
    return;
  }
  res.json(await getActivityForRun(id));
});

/** POST /api/runs/:id/approve-plan — owner launches a large run. */
runsRouter.post("/:id/approve-plan", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const run = await approvePlan(id);
  if (!run) {
    res.status(404).json({ error: `Run ${req.params.id} not found` });
    return;
  }
  res.json(run);
});

/** POST /api/runs/:id/approve — owner approves a finished run. */
runsRouter.post("/:id/approve", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const run = await approveRun(id);
  if (!run) {
    res.status(404).json({ error: `Run ${req.params.id} not found` });
    return;
  }
  res.json(run);
});

/** POST /api/runs/:id/tasks/:taskId/revise — send a result back for revision. */
runsRouter.post("/:id/tasks/:taskId/revise", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const taskId = Number(req.params.taskId);
  const { feedback } = req.body as ReviseTaskRequest;
  if (typeof feedback !== "string" || feedback.trim().length === 0) {
    res.status(400).json({ error: "Field 'feedback' is required and must be a non-empty string." });
    return;
  }
  const run = await reviseTask(id, taskId, feedback.trim());
  if (!run) {
    res.status(404).json({ error: `Run ${req.params.id} or task ${req.params.taskId} not found` });
    return;
  }
  res.json(run);
});
