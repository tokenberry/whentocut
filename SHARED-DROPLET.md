# Running WhenToCut next to another app (shared droplet)

This is the safe path when the droplet **already runs another app**. Nothing here changes
your existing app: WhenToCut gets its own port, its own PM2 process, and (optionally) its
own Nginx subdomain. No database is required to run.

## TL;DR

```bash
ssh <user>@<droplet-ip>

# This box has 2 GB RAM and no swap — add a swapfile so `next build` can't OOM.
# Persisted to fstab so it survives the pending reboot. Skip if you already have swap.
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile \
  && sudo mkswap /swapfile && sudo swapon /swapfile \
  && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

curl -fsSL https://raw.githubusercontent.com/tokenberry/whentocut/main/scripts/setup-shared.sh \
  -o setup-shared.sh
REPO_URL=https://github.com/tokenberry/whentocut.git PORT=3005 bash setup-shared.sh
```

Port **3005** is free on your droplet (3000–3003 are taken by your other apps). The
script clones to `/opt/whentocut`, builds, and starts under PM2 (name `whentocut`),
bound to `127.0.0.1` so only Nginx can reach it. Check it:

```bash
curl -sI http://127.0.0.1:3005/      # expect HTTP/1.1 200 OK
```

## Why it's safe alongside your other app
- **No Node reinstall** — the script uses the Node already on the box; it refuses to run
  (with guidance to use `nvm`) rather than replacing your system Node.
- **No Nginx/Postgres install or edits** — reverse proxy is a separate, additive step.
- **Own port + own PM2 name (`whentocut`)** — won't collide with your other process.
- **Port check** — it aborts if the chosen port is already in use.

## Add a subdomain (recommended)
Your Nginx already fronts several sites (beckstar, bouncywars, eurotruckmaps, …), so this
just adds one more file alongside them — nothing existing is touched.

1. DNS: add an `A` record `whentocut.<your-domain>` → droplet IP (188.166.144.150).
2. Copy the template and point it at port **3005**:
   ```bash
   sudo cp /opt/whentocut/deploy/nginx/whentocut.conf.example \
           /etc/nginx/sites-available/whentocut.conf
   sudo nano /etc/nginx/sites-available/whentocut.conf   # set server_name + proxy_pass port
   sudo ln -s /etc/nginx/sites-available/whentocut.conf /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d whentocut.<your-domain>       # HTTPS; edits only this file
   ```
   (If you use Caddy/Apache instead of Nginx, tell me and I'll give you that snippet.)

## Auto-deploy from GitHub
Once it's running, add three repo secrets so pushes redeploy automatically — see
[DEPLOY.md](./DEPLOY.md#2-auto-deploy-from-github): `DROPLET_HOST`, `DROPLET_USER`,
`DROPLET_SSH_KEY`. `scripts/deploy.sh` reuses the same `PORT`/`DEPLOY_DIR`/`PM2_APP_NAME`,
so deploys stay scoped to WhenToCut.

## Optional: your Steam data
Add a Steamworks publisher/financial key (with the **Sales Data** permission) to `.env`
as `STEAMWORKS_PARTNER_KEY=...`, then `pm2 reload whentocut --update-env`. The dashboard
will then show your trailing-30-day revenue, units, and wishlist adds. Not required to run.

## Optional: a database (later)
Only needed for Phase 4 (history + alerts). When you want it, set `DATABASE_URL` in `.env`
(a new DB in the existing Postgres is fine) and re-run `scripts/deploy.sh` — it runs
migrations automatically when `DATABASE_URL` is present.
