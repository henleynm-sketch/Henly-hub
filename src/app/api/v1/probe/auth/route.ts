import { apiRoute } from "@/lib/api/handler";

// TEMPORARY: exercises the full auth + scope + rate-limit + logging flow.
// Gated on projects:read. Delete this route (src/app/api/v1/probe) before the
// final commit. NOTE: folder is "probe" not "_probe" — Next.js treats
// underscore-prefixed folders as private and excludes them from routing.
export const GET = apiRoute("projects:read", async ({ apiKey, scopes }) => {
  return {
    data: {
      authenticated: true,
      keyName: apiKey.name,
      scopes,
    },
  };
});
