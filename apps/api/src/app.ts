import express from "express";
import helmet from "helmet";
import { corsMiddleware } from "./middleware/cors";
import { callLogger } from "./middleware/guards";
import { errorHandler } from "./middleware/errorHandler";

import { healthRouter } from "./routes/health";
import { projectsRouter } from "./routes/projects";
import { clientsRouter } from "./routes/clients";
import { estimatesRouter } from "./routes/estimates";
import { dailyLogsRouter } from "./routes/dailyLogs";
import { timeEntriesRouter } from "./routes/timeEntries";
import { milestonesRouter } from "./routes/milestones";
import { filesRouter } from "./routes/files";
import { threadsRouter } from "./routes/threads";
import { messagesRouter } from "./routes/messages";
import { usersRouter } from "./routes/users";
import { docsRouter } from "./routes/docs";

// Express app factory (separated from listen() for testability).
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(corsMiddleware);
  // Parse every body as JSON (matches the original Next `req.json()` behavior);
  // malformed JSON → entity.parse.failed → 400 "Request body must be valid JSON".
  app.use(express.json({ limit: "1mb", type: () => true }));

  // Every v1 response is no-store, matching the original Next handler.
  app.use("/api/v1", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // Fire-and-forget request logging (ApiCallLog) for every request.
  app.use(callLogger);

  // Docs first (so /api/v1/openapi.json and /api/v1/docs are not shadowed).
  app.use("/api/v1", docsRouter);

  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/projects", projectsRouter);
  app.use("/api/v1/clients", clientsRouter);
  app.use("/api/v1/estimates", estimatesRouter);
  app.use("/api/v1/daily-logs", dailyLogsRouter);
  app.use("/api/v1/time-entries", timeEntriesRouter);
  app.use("/api/v1/milestones", milestonesRouter);
  app.use("/api/v1/files", filesRouter);
  app.use("/api/v1/threads", threadsRouter);
  app.use("/api/v1/messages", messagesRouter);
  app.use("/api/v1/users", usersRouter);

  // Unknown route → uniform 404 envelope.
  app.use("/api/v1", (_req, res) => {
    res.status(404).json({ ok: false, error: { code: "not_found", message: "Route not found" } });
  });

  app.use(errorHandler);
  return app;
}
