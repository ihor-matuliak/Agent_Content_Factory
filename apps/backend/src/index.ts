/**
 * Backend entry point: an Express 5 server exposing the agent API.
 */
import express from "express";
import cors from "cors";
import { env, hasClaudeCredential, hasTelegram } from "./env.js";
import { pool } from "./db.js";
import { agentsRouter } from "./routes/agents.js";
import { runsRouter } from "./routes/runs.js";
import { eventsRouter } from "./routes/events.js";
import { startQueue, stopQueue } from "./agents/queue.js";

const app = express();

app.use(cors());
app.use(express.json());

/** GET /api/health — liveness + dependency check. */
app.get("/api/health", async (_req, res) => {
  let database = "ok";
  try {
    await pool.query("SELECT 1");
  } catch {
    database = "error";
  }
  res.json({
    status: "ok",
    database,
    claudeCredential: hasClaudeCredential ? "configured" : "missing",
    model: env.anthropicModel,
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/agents", agentsRouter);
app.use("/api/runs", runsRouter);
app.use("/api/events", eventsRouter);

const server = app.listen(env.backendPort, () => {
  console.log(`[backend] listening on http://localhost:${env.backendPort}`);
  console.log(`[backend] health:  http://localhost:${env.backendPort}/api/health`);
  if (!hasClaudeCredential) {
    console.warn(
      "[backend] WARNING: no Claude credential set — chat will fail until CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY is configured in .env.",
    );
  }
  console.log(
    `[backend] telegram notifications: ${hasTelegram ? "enabled" : "disabled (optional)"}`,
  );
  // Start the swarm worker: it resumes any unfinished runs and processes new ones.
  void startQueue();
});

// Graceful shutdown.
function shutdown() {
  console.log("[backend] shutting down...");
  stopQueue();
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
