import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseBody, parsePagination } from "@/lib/api/validation";
import { listTimeEntries, createTimeEntry } from "@/lib/services/timeEntryService";

export const GET = apiRoute("time-entries:read", async ({ url }) => {
  const projectId = url.searchParams.get("projectId") || undefined;
  const userId = url.searchParams.get("userId") || undefined;
  const approvedParam = url.searchParams.get("approved");
  const approved = approvedParam == null ? undefined : approvedParam === "true";
  const { items, nextCursor } = await listTimeEntries(parsePagination(url), { projectId, userId, approved });
  return { data: items, meta: { nextCursor } };
});

const createTimeEntryBody = z.object({
  userId: z.string().min(1),
  projectId: z.string().min(1),
  costCode: z.string().min(1),
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().nullish(),
  hours: z.number().nonnegative().nullish(),
});

export const POST = apiRoute("time-entries:write", async ({ body }) => {
  const input = parseBody(createTimeEntryBody, await body());
  const entry = await createTimeEntry(input);
  return { data: entry, status: 201 };
});
