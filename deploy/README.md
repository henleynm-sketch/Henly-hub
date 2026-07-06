# Henley Hub — production server setup (Hostinger Ubuntu 24.04 VPS)

One-time setup to stand up `hub.henleycontracting.com`. After this, pushes to
`claude/henley-hub-platform-2wIAN` auto-deploy via
`.github/workflows/deploy.yml` (build on server → `prisma db push` → `next build`
→ `pm2 reload`).

**Migration command:** this repo has **no `prisma/migrations/` directory** — it
has only ever used `prisma db push`. So both the first manual run and the CI
workflow use `npx prisma db push`. ⚠️ Before real production data goes live,
commit an initial migration (`npx prisma migrate dev --name init` locally) and
switch the deploy + this runbook to `npx prisma migrate deploy`. `db push` on a
populated prod DB can drop columns on a diff — fine for now (fresh DB), risky later.

**Never run `npm run db:reset` on the server** — it wipes the QBO connection.

Do the steps in order. Placeholders look like `<THIS>`.

---

## 1. DNS

Add an **A record**: `hub` → your VPS IPv4 (and an `AAAA` record to the IPv6 if
you have one). Wait for it to resolve (`dig +short hub.henleycontracting.com`)
before running Certbot in step 8.

## 2. Create the non-root `deploy` user + CI key

SSH in as root (or your sudo user), then:

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy          # optional; needed only if deploy runs sudo tasks
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
# Paste the CI deploy key's PUBLIC half (one line) into authorized_keys:
nano /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

Generate the CI keypair on your own machine (not the server):
`ssh-keygen -t ed25519 -C "henley-hub-ci" -f henley-hub-ci` — the **public**
half goes in `authorized_keys` above; the **private** half becomes the
`SSH_PRIVATE_KEY` GitHub Secret (step 9). Do the rest as the `deploy` user:
`su - deploy`.

## 3. Node 20 via nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
nvm install 20 && nvm alias default 20
```

## 4. PM2

```bash
npm i -g pm2
pm2 startup      # prints a sudo command — run it once so PM2 restarts on reboot
```

## 5. Clone the repo to the deploy path

```bash
cd ~
git clone https://github.com/henleynm-sketch/my-project.git henley-hub
cd henley-hub
git checkout claude/henley-hub-platform-2wIAN
```

Deploy path is now `/home/deploy/henley-hub` — this must match `cwd` in
`ecosystem.config.js` and the `DEPLOY_PATH` secret.

## 6. Create the server `.env` (gitignored — never committed)

```bash
nano .env
```

```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="<openssl rand -hex 32>"
AUTH_URL="https://hub.henleycontracting.com"
AUTH_TRUST_HOST="true"

# QuickBooks — PRODUCTION creds (see QBO note below), not sandbox
QB_ENV="production"
QB_CLIENT_ID="<prod client id>"
QB_CLIENT_SECRET="<prod client secret>"
QB_REDIRECT_URI="https://hub.henleycontracting.com/api/auth/quickbooks/callback"

# Microsoft 365 mailbox sync
M365_TENANT_ID="<tenant id>"
M365_CLIENT_ID="<client id>"
M365_CLIENT_SECRET="<client secret>"
M365_MAILBOX="automation@henleycontracting.com"

# Quo (OpenPhone) SMS/voice
HENLEY_TASKS_API_KEY=""   # set if using the .env fallback; else stored in DB
```

(SQLite lives at `/home/deploy/henley-hub/dev.db` on the server — the deploy
uses `git reset --hard` **without** `git clean`, so this file and `.env` survive
every deploy.)

## 7. First manual build + start

```bash
npm ci
npx prisma generate
npx prisma db push          # NOT migrate deploy — see the note at the top
npm run build               # needs ~2GB RAM (see swap caveat below)
pm2 start ecosystem.config.js
pm2 save
```

Confirm it's up locally: `curl -I http://127.0.0.1:3000` → `200`/`307`.

## 8. Nginx + HTTPS

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx/hub.henleycontracting.com.conf /etc/nginx/sites-available/hub.henleycontracting.com.conf
sudo ln -s /etc/nginx/sites-available/hub.henleycontracting.com.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d hub.henleycontracting.com   # adds the 443 block + redirect
```

## 9. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw enable
```

---

## GitHub Secrets (Settings → Secrets and variables → Actions)

| Secret | Value |
|---|---|
| `SSH_HOST` | VPS IP or hostname |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | the **private** half of the CI keypair (full PEM, incl. header/footer) |
| `SSH_PORT` | SSH port (`22` unless changed) |
| `DEPLOY_PATH` | `/home/deploy/henley-hub` |

## ⚠️ Pushing the workflow needs a `workflow`-scoped token

GitHub blocks pushing anything under `.github/workflows/` unless your token/PAT
has the **`workflow`** scope. The current PAT lacks it — that's why the earlier
`ci.yml` never landed. Two fixes:

- **Easiest:** add `deploy.yml` through the GitHub **web UI** (Add file → paste),
  or
- Re-auth git with a PAT that has the `workflow` scope (or `gh auth login`), then
  push normally.

The other three files (`ecosystem.config.js`, the nginx conf, this README) are
**not** under `.github/workflows/`, so they push with a normal token.

## ⚠️ Build RAM / swap

`next build` needs ~2GB+. On small VPS plans add a swap file first, or the build
gets OOM-killed:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## ⚠️ QBO production OAuth

Production QuickBooks OAuth is **separate** from the sandbox app. Before flipping
QBO live: register the **production** redirect URI
(`https://hub.henleycontracting.com/api/auth/quickbooks/callback`) in the Intuit
developer portal, put the prod client id/secret in `.env` (step 6), and keep
`QB_ENV=production`. Do not reuse sandbox credentials.

---

## After setup: how deploys work

Push to `claude/henley-hub-platform-2wIAN` (or run the workflow manually from the
Actions tab). The workflow SSHes in as `deploy`, `git reset --hard` to the pushed
commit, `npm ci`, `prisma generate`, `prisma db push`, `next build`, then
`pm2 reload`. `.env`, `dev.db`, and uploads are untouched. Watch a run in the
**Actions** tab; roll back by pushing a revert (or `git reset --hard <old sha>`
on the server + `pm2 reload`).
