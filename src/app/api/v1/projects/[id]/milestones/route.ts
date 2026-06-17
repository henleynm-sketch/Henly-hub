import { apiRoute } from "@/lib/api/handler";
import { listProjectMilestones } from "@/lib/services/milestoneService";

export const GET = apiRoute<{ id: string }>("milestones:read", async ({ params }) => {
  return { data: await listProjectMilestones(params.id) };
});
