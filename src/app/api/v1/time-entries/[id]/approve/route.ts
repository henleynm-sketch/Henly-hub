import { apiRoute } from "@/lib/api/handler";
import { approveTimeEntry } from "@/lib/services/timeEntryService";

// API consumers operate as a system user, not a human role — approvedById is
// left null. The QBO push stays in the internal flow (guardrail).
export const POST = apiRoute<{ id: string }>("time-entries:approve", async ({ params }) => {
  return { data: await approveTimeEntry(params.id, null) };
});
