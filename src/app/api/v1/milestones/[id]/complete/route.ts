import { apiRoute } from "@/lib/api/handler";
import { completeMilestone } from "@/lib/services/milestoneService";

export const POST = apiRoute<{ id: string }>("milestones:complete", async ({ params }) => {
  return { data: await completeMilestone(params.id) };
});
