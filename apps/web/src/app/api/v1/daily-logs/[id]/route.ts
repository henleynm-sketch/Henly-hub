import { apiRoute } from "@/lib/api/handler";
import { getDailyLogById } from "@/lib/services/dailyLogService";

export const GET = apiRoute<{ id: string }>("daily-logs:read", async ({ params }) => {
  return { data: await getDailyLogById(params.id) };
});
