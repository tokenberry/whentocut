# Deploying WhenToCut on a DigitalOcean droplet

Self-hosted, always-on Node process behind Nginx. No serverless constraints, so the
scheduler and Postgres live on the same box (or a managed DB).

## 1. Provision

- Ubuntu droplet, Node 22 (via `nvm` or NodeSource), and Postgres 16.
- Create the DB and user:
  ```sql
  CREATE DATABASE whentocut;
  CREATE USER whentocut WITH PASSWORD '...';
  GRANT ALL PRIVILEGES ON DATABASE whentocut TO whentocut;
  ```

## 2. App

```bash
git clone <repo> /opt/whentocut && cd /opt/whentocut
cp .env.example .env        # fill in DATABASE_URL, ENCRYPTION_KEY, CRON_SECRET, Resend, DO Spaces
npm ci
npx prisma migrate deploy   # apply schema
npm run build
```

Run under **PM2** (or a systemd unit):

```bash
npm i -g pm2
pm2 start "npm run start" --name whentocut
pm2 save && pm2 startup
```

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
