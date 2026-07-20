// PM2 process config for Henley Hub in production.
//
// Started/reloaded by the SSH deploy (see .github/workflows/deploy.yml) and by
// the one-time server setup (see deploy/README.md). Real secrets are NOT here —
// they live in the server's gitignored .env and are read at runtime.

module.exports = {
  apps: [
    {
      name: "henley-hub",
      // Monorepo: the Next.js app lives in apps/web, so start it through the
      // workspace's own `npm start` — that runs `dotenv -e ../../.env -- next
      // start`, loading the root .env (auth vars) exactly like every other
      // script in this repo. `next start` honors the PORT env below.
      script: "npm",
      args: "start",
      // Server deploy path. Change here (and DEPLOY_PATH secret) if you clone
      // the repo somewhere other than the default.
      cwd: "/home/deploy/henley-hub/apps/web",

      // Single fork instance — do NOT switch to cluster mode. Two reasons, both
      // process-local state that cluster would fork and corrupt:
      //   1. SQLite: one file, one writer. Multiple workers = lock contention.
      //   2. The v1 API rate limiter + idempotency cache are in-memory Maps;
      //      under cluster each worker would keep its own, breaking both.
      // Revisit only after Postgres + a shared (Redis) store land.
      instances: 1,
      exec_mode: "fork",

      autorestart: true,
      max_memory_restart: "1G",

      // Only non-secret runtime config. Everything else comes from server .env.
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
