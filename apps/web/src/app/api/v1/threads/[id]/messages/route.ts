import { apiRoute } from "@/lib/api/handler";
import { parsePagination } from "@/lib/api/validation";
import { listThreadMessages } from "@/lib/services/threadService";

export const GET = apiRoute<{ id: string }>("messages:read", async ({ params, url }) => {
  const { items, nextCursor } = await listThreadMessages(params.id, parsePagination(url));
  return { data: items, meta: { nextCursor } };
});
