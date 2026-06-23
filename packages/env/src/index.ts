import { z } from "zod";
import { config } from "dotenv";
import path from "node:path";

// Load the monorepo-root .env regardless of which workspace the consumer runs
// from. apps/web (Next) also auto-loads its own env; this loader is primarily
// for apps/api and any standalone Node entry points. It never overrides values
// already present in process.env.
config({ path: path.resolve(process.cwd(), ".env") });
config({ path: path.resolve(__dirname, "../../../.env") });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),

  // Auth.js v5 (apps/web owns auth; these are optional here for completeness)
  AUTH_SECRET: z.string().optional(),
  AUTH_URL: z.string().optional(),
  AUTH_TRUST_HOST: z.string().optional(),

  // QuickBooks (sandbox by default; do not log these)
  QB_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  QB_CLIENT_ID: z.string().optional(),
  QB_CLIENT_SECRET: z.string().optional(),
  QB_REDIRECT_URI: z.string().optional(),

  // Door 1 legacy key — still live for Ayandip's Henley Tasks app.
  HUB_TASKS_API_KEY: z.string().optional(),

  // Ports
  API_PORT: z.coerce.number().default(3001),
  WEB_PORT: z.coerce.number().default(3000),

  // Cross-origin
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  API_ORIGIN: z.string().default("http://localhost:3001"),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
