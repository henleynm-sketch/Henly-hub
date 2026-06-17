import { apiRoute } from "@/lib/api/handler";
import { parsePagination } from "@/lib/api/validation";
import { listThreads } from "@/lib/services/threadService";

export const GET = apiRoute("threads:read", async ({ url }) => {
  const clientId = url.searchParams.get("clientId") || undefined;
  const channel = url.searchParams.get("channel") || undefined;
  const { items, nextCursor } = await listThreads(parsePagination(url), { clientId, channel });
  return { data: items, meta: { nextCursor } };
});
