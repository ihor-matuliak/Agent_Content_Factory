/**
 * Notification feed routes: list events, get the unread count (sidebar badge),
 * and mark everything read.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { countUnreadEvents, listEvents, markAllEventsRead } from "../journal.js";

export const eventsRouter = Router();

/** GET /api/events — recent notifications, newest first. */
eventsRouter.get("/", async (_req: Request, res: Response) => {
  res.json(await listEvents());
});

/** GET /api/events/unread-count — number of unread notifications. */
eventsRouter.get("/unread-count", async (_req: Request, res: Response) => {
  res.json({ count: await countUnreadEvents() });
});

/** POST /api/events/read — mark all notifications as read. */
eventsRouter.post("/read", async (_req: Request, res: Response) => {
  await markAllEventsRead();
  res.json({ ok: true });
});
