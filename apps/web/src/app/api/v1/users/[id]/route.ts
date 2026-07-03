import { apiRoute } from "@/lib/api/handler";
import { getUserById } from "@/lib/services/userService";

export const GET = apiRoute<{ id: string }>("users:read", async ({ params }) => {
  return { data: await getUserById(params.id) };
});
