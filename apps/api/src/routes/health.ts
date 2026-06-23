import { Router } from "express";
import { ok } from "../lib/envelope";

// Public health check — no auth, no rate limit. Confirms the v1 surface is up.
export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json(ok({ service: "henley-hub", version: "v1", time: new Date().toISOString() }));
});
