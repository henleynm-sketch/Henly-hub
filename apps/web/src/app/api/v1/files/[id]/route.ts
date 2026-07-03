import { apiRoute } from "@/lib/api/handler";
import { getFileById } from "@/lib/services/fileService";

export const GET = apiRoute<{ id: string }>("files:read", async ({ params }) => {
  return { data: await getFileById(params.id) };
});
