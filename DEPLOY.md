# Deploying WhenToCut on a DigitalOcean droplet

Self-hosted, always-on Node process behind Nginx. No serverless constraints, so the
scheduler and Postgres live on the same box (or a managed DB).

## 1. Provision (one time)

Run the bootstrap script on a fresh Ubuntu droplet (installs Node 22, PM2, Postgres,
Nginx; clones the repo to `/opt/whentocut`; creates `.env` from the template):

```bash
ssh root@<droplet-ip>
curl -fsSL https://raw.githubusercontent.com/tokenberry/whentocut/main/scripts/provision.sh | \
  REPO_URL=https://github.com/tokenberry/whentocut.git bash
```

Then create the DB/user and fill in `.env`:

```sql
CREATE DATABASE whentocut;
CREATE USER whentocut WITH PASSWORD '...';
GRANT ALL PRIVILEGES ON DATABASE whentocut TO whentocut;
```
```bash
cd /opt/whentocut
nano .env   # DATABASE_URL, STEAMWORKS_PARTNER_KEY, CRON_SECRET, ENCRYPTION_KEY, Resend, DO Spaces
./scripts/deploy.sh main   # first manual deploy: install + migrate + build + pm2 start
```

## 2. Auto-deploy from GitHub

`.github/workflows/deploy.yml` SSHes into the droplet and runs `scripts/deploy.sh` on
every push to `main` (and `claude/**` branches), or on manual **Run workflow**. It does:
`git reset --hard origin/<branch>` → `npm ci` → `prisma migrate deploy` (if `DATABASE_URL`
set) → `npm run build` → `pm2 reload`.

**Add these repo secrets** (GitHub → Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `DROPLET_HOST` | droplet IP / hostname |
| `DROPLET_USER` | deploy SSH user (e.g. `root` or a `deploy` user) |
| `DROPLET_SSH_KEY` | **private** key whose public half is in the droplet's `~/.ssh/authorized_keys` |
| `DROPLET_PORT` | optional, defaults to `22` |

Generate a dedicated deploy key:

```bash
ssh-keygen -t ed25519 -f deploy_key -N ""        # locally
ssh-copy-id -i deploy_key.pub <user>@<droplet-ip>  # authorize the public half
# paste the PRIVATE key (deploy_key) into the DROPLET_SSH_KEY secret, then delete it locally
```

After that, pushing to GitHub redeploys automatically — watch the run under the repo's
**Actions** tab.

## 3. Nginx + TLS

Reverse-proxy `:3000`, terminate TLS with Certbot:

```nginx
server {
  server_name whentocut.app;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
}
```
```bash
sudo certbot --nginx -d whentocut.app
```

## 4. Scheduled evaluation

Always-on process means a plain cron is enough. Hit the secret-guarded evaluator daily:

```cron
0 9 * * *  curl -fsS -X POST https://whentocut.app/api/cron/evaluate \
             -H "x-cron-secret: $CRON_SECRET"
```

(Or run `node-cron` inside the app process — both work since the process never sleeps.)

## 5. DO Spaces

Full snapshot JSON is archived to **DO Spaces** (S3-compatible) using the
`DO_SPACES_*` env vars; Postgres keeps only the queryable snapshot fields. Use any
S3 client/SDK pointed at `DO_SPACES_ENDPOINT`.

## Secrets

`.env` is gitignored. Partner Web API keys are additionally **encrypted at rest**
(AES-GCM with `ENCRYPTION_KEY`) in `PartnerCredential`, never logged, never sent to the
browser.
