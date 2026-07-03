import { apiRoute } from "@/lib/api/handler";
import { parsePagination } from "@/lib/api/validation";
import { listProjectDailyLogs } from "@/lib/services/dailyLogService";

export const GET = apiRoute<{ id: string }>("daily-logs:read", async ({ params, url }) => {
  const { items, nextCursor } = await listProjectDailyLogs(params.id, parsePagination(url));
  return { data: items, meta: { nextCursor } };
});
