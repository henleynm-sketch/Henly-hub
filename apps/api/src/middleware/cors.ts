import cors from "cors";
import { env } from "@repo/env";

// Browser CORS is only relevant to browser-based consumers. External API
// consumers (Henley Tasks, future server apps) are server-to-server with bearer
// tokens — CORS does not apply to them. We allow the Hub web origin so the
// in-app Swagger "Try it out" and any future browser client can call the API.
export const corsMiddleware = cors({
  origin: [env.WEB_ORIGIN],
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
  exposedHeaders: ["Idempotency-Replayed", "Retry-After"],
});
