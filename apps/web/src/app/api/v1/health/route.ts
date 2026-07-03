import { ok } from "@/lib/api/errors";

// Public health check — no auth, no rate limit. Confirms the v1 surface is up.
export async function GET() {
  return ok({ service: "henley-hub", version: "v1", time: new Date().toISOString() });
}
