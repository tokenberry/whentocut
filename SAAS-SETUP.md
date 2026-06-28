# Phase 5a — Accounts setup (do this BEFORE merging the PR)

Merging to `main` auto-deploys. The accounts release needs a database + env vars first,
or the deploy will fail / the live site will break. Set these up on the droplet, then merge.

## 1. Create the database (reuse the existing Postgres)
```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE whentocut;
CREATE USER whentocut WITH PASSWORD 'pick-a-strong-password';
GRANT ALL PRIVILEGES ON DATABASE whentocut TO whentocut;
\c whentocut
GRANT ALL ON SCHEMA public TO whentocut;
SQL
```

## 2. Google OAuth
[console.cloud.google.com](https://console.cloud.google.com) → APIs & Services →
Credentials → **Create OAuth client ID** → Web application:
- Authorized redirect URI: `https://whentocut.com/api/auth/callback/google`
- Copy the **Client ID** and **Client secret**.

## 3. Resend (magic-link email)
[resend.com](https://resend.com) → verify the `whentocut.com` domain (add the DNS records
in Namecheap) → create an **API key**. Sender: `login@whentocut.com`.

## 4. Fill in `/opt/whentocut/.env`
```dotenv
DATABASE_URL="postgresql://whentocut:pick-a-strong-password@localhost:5432/whentocut?schema=public"
AUTH_SECRET="<openssl rand -base64 33>"
AUTH_URL="https://whentocut.com"
AUTH_TRUST_HOST="true"
AUTH_GOOGLE_ID="<from step 2>"
AUTH_GOOGLE_SECRET="<from step 2>"
AUTH_RESEND_KEY="<from step 3>"
AUTH_EMAIL_FROM="login@whentocut.com"
ENCRYPTION_KEY="<node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\">"
```
Generate secrets:
```bash
openssl rand -base64 33                                            # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # ENCRYPTION_KEY
```

## 5. Merge the PR
Once CI is green and the env is set, merge the PR. The deploy runs `prisma db push`
(creates the tables) and reloads the app. Then:
- Sign in at `https://whentocut.com/signin` (Google or magic link)
- Track a game from its dashboard; manage it at `/account`
- Optionally connect your Steamworks key under **Account → Steamworks data**

## 6. Email alerts (Phase 5b — included in this PR)
Alerts reuse your Resend setup. Ensure `.env` has (the alert key can equal the auth key):
```dotenv
RESEND_API_KEY=""          # optional — falls back to AUTH_RESEND_KEY
ALERT_FROM_EMAIL="alerts@whentocut.com"
CRON_SECRET="<openssl rand -hex 16>"
```
Add a daily cron on the droplet to evaluate tracked games and email when it's time:
```bash
crontab -e
# 09:00 UTC daily:
0 9 * * *  curl -fsS -X POST https://whentocut.com/api/cron/evaluate -H "x-cron-secret: YOUR_CRON_SECRET"
```
The evaluator only emails when a game's recommendation **changes** (no daily spam), and
links back to the dashboard + Steamworks.

## 7. Billing — Polar (Phase 5c)
After creating the **WhenToCut Pro** product (monthly price, no benefits):
1. **Settings → Developers → New Token** → copy the **Organization Access Token**.
2. **Settings → Webhooks → Add Endpoint**:
   - URL: `https://whentocut.com/api/polar/webhook`
   - Format: **Raw**
   - Events: the **subscription.*** events (at least `subscription.active`,
     `subscription.updated`, `subscription.revoked`)
   - Copy the **signing secret**.
3. **Product id:** open the product → copy its id (in the page URL / details).
4. Add to `.env` and `pm2 reload whentocut --update-env`:
   ```dotenv
   POLAR_ACCESS_TOKEN="polar_oat_..."
   POLAR_WEBHOOK_SECRET="..."
   POLAR_PRODUCT_ID="..."
   POLAR_SERVER="production"
   ```
Then `/account` shows an **Upgrade to Pro** button → Polar checkout → on success the
webhook flips the user to **PRO**. Cancel/refund flips them back on `subscription.revoked`.

## Notes
- **Free vs Pro:** Free tracks 1 game; Pro is unlimited. Alerts currently go to all
  tracked games; they'll be gated to Pro when billing (Polar) lands in 5c.
- Schema changes use `prisma db push` for now (no migration files); we can adopt
  versioned migrations once the schema stabilizes.
