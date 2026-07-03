# Running Henley Hub locally

Your machine is already set up: dependencies installed, `.env` present, and the
SQLite database (`prisma/dev.db`) is migrated and seeded (9 users, 4 projects).
You normally just need **one command**.

## Everyday: dev mode (hot reload)

```bash
npm run dev
```

Open http://localhost:3000 and sign in. Demo logins (password `demo` for all):

| Role        | Email                  | Sees                                        |
|-------------|------------------------|---------------------------------------------|
| CEO / Owner | kyle@henleyhub.com     | Everything                                  |
| Office / PM | morgan@henleyhub.com   | CRM, projects, estimates, contracts, money  |
| Field lead  | jess@henleyhub.com     | Assigned jobs, daily logs, time clock       |
| Sub         | tile-pro@subs.com      | Assigned scopes, plans/permits, messages    |
| Client      | rachel.t@example.com   | Their project, shared docs & updates        |

The bottom-right "Switch role (demo)" button flips between them without signing out.

## If a page errors after I change the schema

Only needed when the data model changed (I'll tell you when it does):

```bash
npx prisma db push      # apply schema to dev.db  (answer y to any drop warning)
npx prisma generate     # rebuild the typed client
# then stop the dev server (Ctrl+C) and `npm run dev` again
```

Never run `npm run db:reset` — it wipes the QuickBooks connection.

## See it the way it'll look deployed (production build)

This is the closest thing to a real deploy, still on your machine:

```bash
# stop the dev server first — never build while dev is running
npx kill-port 3000
npm run build
npm start            # serves the optimized build on http://localhost:3000
```

If the build ever complains about a stale cache, delete the `.next` folder and
rebuild: `rmdir /s /q .next` (Windows) then `npm run build`.

## Ports are stuck / "address in use"

```bash
npx kill-port 3000 3001
npm run dev
```

## Install it as an app (PWA)

With the server running, Chrome shows an install icon in the address bar — click
it for a desktop/taskbar app. On a phone (same Wi‑Fi, visit your computer's LAN
IP like `http://192.168.1.x:3000`): Share → Add to Home Screen.

---

When you're ready to put this on a real host so the team and Henley Tasks can
reach it, the two things to settle first are the **database** (SQLite → Postgres)
and **file uploads** (local disk → object storage, or a host with a persistent
disk). Tell me the host and I'll prep the repo and write the deploy steps.
