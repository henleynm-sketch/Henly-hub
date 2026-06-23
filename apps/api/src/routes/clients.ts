import { Router } from "express";
import { z } from "zod";
import { requireScope } from "../middleware/auth";
import { rateLimit, idempotency } from "../middleware/guards";
import { asyncHandler, reqUrl } from "../lib/handler";
import { ok } from "../lib/envelope";
import { parseBody, parsePagination, listClients, createClient, getClientById, updateClient } from "@repo/services";

export const clientsRouter = Router();

clientsRouter.get(
  "/",
  requireScope("clients:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    const { items, nextCursor } = await listClients(parsePagination(reqUrl(req)));
    res.json(ok(items, { nextCursor }));
  })
);

const createClientBody = z.object({
  name: z.string().min(1),
  primaryEmail: z.string().email().nullish(),
  primaryPhone: z.string().nullish(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  zip: z.string().nullish(),
  source: z.string().nullish(),
  stage: z.string().optional(),
  notes: z.string().nullish(),
});

clientsRouter.post(
  "/",
  requireScope("clients:write"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    const input = parseBody(createClientBody, req.body);
    const client = await createClient(input);
    res.status(201).json(ok(client));
  })
);

clientsRouter.get(
  "/:id",
  requireScope("clients:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    res.json(ok(await getClientById(req.params.id)));
  })
);

const updateClientBody = z.object({
  name: z.string().min(1).optional(),
  primaryEmail: z.string().email().nullish(),
  primaryPhone: z.string().nullish(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  zip: z.string().nullish(),
  source: z.string().nullish(),
  stage: z.string().optional(),
  notes: z.string().nullish(),
});

clientsRouter.patch(
  "/:id",
  requireScope("clients:write"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    const input = parseBody(updateClientBody, req.body);
    res.json(ok(await updateClient(req.params.id, input)));
  })
);
