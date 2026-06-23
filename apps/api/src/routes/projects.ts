import { Router } from "express";
import { z } from "zod";
import { requireScope } from "../middleware/auth";
import { rateLimit, idempotency } from "../middleware/guards";
import { asyncHandler, reqUrl } from "../lib/handler";
import { ok } from "../lib/envelope";
import {
  parseBody,
  parsePagination,
  listProjects,
  createProject,
  getProjectById,
  updateProject,
  archiveProject,
  listProjectDailyLogs,
  listProjectMilestones,
  listProjectFiles,
} from "@repo/services";

export const projectsRouter = Router();

// GET /api/v1/projects
projectsRouter.get(
  "/",
  requireScope("projects:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    const { items, nextCursor } = await listProjects(parsePagination(reqUrl(req)));
    res.json(ok(items, { nextCursor }));
  })
);

const createProjectBody = z.object({
  name: z.string().min(1),
  clientId: z.string().min(1),
  address: z.string().nullish(),
  contractCents: z.number().int().nonnegative().optional(),
  budgetCents: z.number().int().nonnegative().optional(),
  description: z.string().nullish(),
  status: z.string().optional(),
});

// POST /api/v1/projects
projectsRouter.post(
  "/",
  requireScope("projects:write"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    const input = parseBody(createProjectBody, req.body);
    const project = await createProject(input);
    res.status(201).json(ok(project));
  })
);

// GET /api/v1/projects/:id
projectsRouter.get(
  "/:id",
  requireScope("projects:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    res.json(ok(await getProjectById(req.params.id)));
  })
);

const updateProjectBody = z.object({
  name: z.string().min(1).optional(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  status: z.string().optional(),
  currentPhase: z.string().nullish(),
  nextStep: z.string().nullish(),
  team: z.string().nullish(),
  contractCents: z.number().int().nonnegative().optional(),
  budgetCents: z.number().int().nonnegative().optional(),
  description: z.string().nullish(),
});

// PATCH /api/v1/projects/:id
projectsRouter.patch(
  "/:id",
  requireScope("projects:write"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    const input = parseBody(updateProjectBody, req.body);
    res.json(ok(await updateProject(req.params.id, input)));
  })
);

// POST /api/v1/projects/:id/archive
projectsRouter.post(
  "/:id/archive",
  requireScope("projects:archive"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    res.json(ok(await archiveProject(req.params.id)));
  })
);

// GET /api/v1/projects/:id/daily-logs
projectsRouter.get(
  "/:id/daily-logs",
  requireScope("daily-logs:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    const { items, nextCursor } = await listProjectDailyLogs(req.params.id, parsePagination(reqUrl(req)));
    res.json(ok(items, { nextCursor }));
  })
);

// GET /api/v1/projects/:id/milestones
projectsRouter.get(
  "/:id/milestones",
  requireScope("milestones:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    res.json(ok(await listProjectMilestones(req.params.id)));
  })
);

// GET /api/v1/projects/:id/files
projectsRouter.get(
  "/:id/files",
  requireScope("files:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    res.json(ok(await listProjectFiles(req.params.id)));
  })
);
