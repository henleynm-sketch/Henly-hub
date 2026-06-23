import { Router } from "express";
import { requireScope } from "../middleware/auth";
import { rateLimit } from "../middleware/guards";
import { asyncHandler, reqUrl } from "../lib/handler";
import { ok } from "../lib/envelope";
import { parsePagination, listUsers, getUserById } from "@repo/services";

export const usersRouter = Router();

// GET /api/v1/users
usersRouter.get(
  "/",
  requireScope("users:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    const { items, nextCursor } = await listUsers(parsePagination(reqUrl(req)));
    res.json(ok(items, { nextCursor }));
  })
);

// GET /api/v1/users/:id
usersRouter.get(
  "/:id",
  requireScope("users:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    res.json(ok(await getUserById(req.params.id)));
  })
);
