import { apiRoute } from "@/lib/api/handler";
import { parsePagination } from "@/lib/api/validation";
import { listUsers } from "@/lib/services/userService";

export const GET = apiRoute("users:read", async ({ url }) => {
  const { items, nextCursor } = await listUsers(parsePagination(url));
  return { data: items, meta: { nextCursor } };
});
