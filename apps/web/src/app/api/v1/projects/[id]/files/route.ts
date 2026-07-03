import { apiRoute } from "@/lib/api/handler";
import { listProjectFiles } from "@/lib/services/fileService";

export const GET = apiRoute<{ id: string }>("files:read", async ({ params }) => {
  return { data: await listProjectFiles(params.id) };
});
