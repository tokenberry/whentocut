# WhenToCut — Status & Handoff

Living record of what's built and what's next. **No secrets here (public repo)** — all
secrets live in `/opt/whentocut/.env` on the droplet.

## Live
- **Prod:** https://whentocut.com — DigitalOcean droplet `188.166.144.150` (London).
- **Shared droplet** (also runs beckstar, bouncywars, etc.). WhenToCut runs on **port 3005**
  under **PM2** (app `whentocut`), bound to `127.0.0.1`, behind **Nginx** with TLS (certbot).
- **Domain:** whentocut.com (apex, **Namecheap** DNS — A records `@` and `www` → droplet).
- **Auto-deploy:** push/merge to **`main`** → GitHub Actions (`.github/workflows/deploy.yml`)
  SSHes in and runs `scripts/deploy.sh` (git reset → `npm ci` → `prisma db push` → build →
  `pm2 reload`). Every PR is checked by `.github/workflows/ci.yml` (typecheck + build + test).
- **Branching:** `main` = production; feature work via branch → PR → CI → merge → deploy.

## Stack
Next.js 15 (App Router) + TS + React 19 · Postgres (host DB `whentocut`) via Prisma 6
(`prisma db push`, no migration files yet) · Auth.js (NextAuth v5) · Polar (billing) ·
Resend (email). Pure heuristic engine in `lib/recommendation`; Steam data in `lib/steam`.

## Done
1. **Public advisor** — Steam Store + SteamSpy + live players → recommendation engine
   (30-day cooldown, post-price-increase lockout, depth escalation, seasonal-sale alignment,
   value-erosion guardrail) with human-readable reasons. Landing + `/dashboard/[appid]`.
2. **Live Steamworks partner API** (`lib/steam/partnerClient.ts`) — trailing-30d net
   revenue/units + wishlist adds; per-user key or env fallback.
3. **Accounts** — Auth.js Google OAuth + email magic-link, DB sessions; `/account`; per-user
   tracked games (Free = 1, Pro = unlimited); per-user Steam key encrypted AES-256-GCM
   (`lib/crypto.ts`).
4. **Email alerts (CODE ONLY, not active)** — `/api/cron/evaluate` re-evaluates tracked
   games and emails on change (`lib/alerts/notify.ts` `alertSignature` de-dup, `lib/email.ts`
   Resend sender).
5. **Billing (Polar)** — `/api/polar/checkout` + `/api/polar/webhook` flip plan PRO/FREE.
   Product "WhenToCut" $9.99/mo (id `4130c1e1-1152-4ade-a2e6-68a011778cec`). Upgrade button
   on `/account`.

32 unit tests; CI green. Docs: `README.md`, `DEPLOY.md`, `SHARED-DROPLET.md`, `SAAS-SETUP.md`.

## Config state (`/opt/whentocut/.env`, gitignored)
- **Set:** `PORT=3005`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`,
  `AUTH_GOOGLE_ID/SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `POLAR_ACCESS_TOKEN`,
  `POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCT_ID`, `POLAR_SERVER=production`.
- **NOT set yet:** `RESEND_API_KEY` / `AUTH_RESEND_KEY`, `ALERT_FROM_EMAIL` (blocks email
  magic-link login AND email alerts).
- **GitHub repo secrets:** `DROPLET_HOST`, `DROPLET_USER` (root), `DROPLET_SSH_KEY`.

## TODO / next session
1. **Activate email alerts (Step 6):** create Resend account + API key; verify
   `whentocut.com` in Resend (Namecheap DNS); set `RESEND_API_KEY`/`AUTH_RESEND_KEY` +
   `ALERT_FROM_EMAIL` in `.env`; add a daily cron:
   `0 9 * * * curl -fsS -X POST https://whentocut.com/api/cron/evaluate -H "x-cron-secret: $CRON_SECRET"`.
   (Also enables email magic-link login.)
2. **Verify Polar end-to-end:** confirm checkout opens; confirm a real subscription flips a
   user to PRO via webhook (or send a Polar test event). Then consider gating **alerts to Pro**.
3. **Harden `scripts/deploy.sh` self-update bug:** the script `git reset`s itself mid-run, so
   Bash keeps executing the OLD in-memory version that deploy. Re-exec the script after the
   git update. (This caused the one-time "login tables not created" issue.)
4. **Security hygiene:** rotate secrets shared during setup (`AUTH_GOOGLE_SECRET`,
   `AUTH_SECRET`); consider a non-root `deploy` SSH user instead of root.
5. **Polish:** Polar customer-portal "Manage subscription" link on `/account`; adopt Prisma
   migrations once schema stabilizes; wishlist true-total (Phase 4 partner); snapshot history
   + DO Spaces; tests for the alerts cron + billing webhook.
6. **Minor:** `pm2 update` (in-memory 6.0.14 vs local 7.0.1 mismatch warning).

## Handy commands (on droplet)
```bash
pm2 logs whentocut --lines 60 --nostream                 # app logs
sudo -u postgres psql -d whentocut -c "\dt"              # list tables
# make self Pro (test): UPDATE "User" SET plan='PRO' WHERE email='you@example.com';
cd /opt/whentocut && set -a && . ./.env && set +a && npx prisma db push   # manual schema sync
```
