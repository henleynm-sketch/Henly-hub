import { apiRoute } from "@/lib/api/handler";
import { approveTimeEntry } from "@/lib/services/timeEntryService";

// API consumers operate as a system user, not a human role — approvedById is
// left null. approveTimeEntry now triggers the same QBO TimeActivity push as the
// UI flow (via the existing pusher); a failed push surfaces as an error response.
export const POST = apiRoute<{ id: string }>("time-entries:approve", async ({ params }) => {
  return { data: await approveTimeEntry(params.id, null) };
});
