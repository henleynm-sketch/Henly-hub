// PM2 process config for Henley Hub in production.
//
// Started/reloaded by the SSH deploy (see .github/workflows/deploy.yml) and by
// the one-time server setup (see deploy/README.md). Real secrets are NOT here —
// they live in the server's gitignored .env and are read at runtime.

module.exports = {
  apps: [
    {
      name: "henley-hub",
      // Run Next.js directly (avoids an extra `npm` shell process under PM2).
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      // Server deploy path. Change here (and DEPLOY_PATH secret) if you clone
      // the repo somewhere other than the default.
      cwd: "/home/deploy/henley-hub",

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
