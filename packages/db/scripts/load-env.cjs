// Loads the repo-root .env, then execs the command passed as arguments.
// Prisma CLI run from packages/db needs DATABASE_URL, which lives in the
// monorepo-root .env (gitignored). Usage:
//   node scripts/load-env.cjs prisma db push --schema prisma/schema.prisma
//   node scripts/load-env.cjs tsx prisma/seed.ts
const path = require("node:path");
const { spawnSync } = require("node:child_process");

require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const [, , cmd, ...args] = process.argv;
if (!cmd) {
  console.error("load-env.cjs: no command provided");
  process.exit(1);
}

const res = spawnSync(cmd, args, { stdio: "inherit", shell: true, env: process.env });
process.exit(res.status ?? 1);
