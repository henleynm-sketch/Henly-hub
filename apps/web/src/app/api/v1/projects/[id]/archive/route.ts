import { apiRoute } from "@/lib/api/handler";
import { archiveProject } from "@/lib/services/projectService";

export const POST = apiRoute<{ id: string }>("projects:archive", async ({ params }) => {
  return { data: await archiveProject(params.id) };
});
