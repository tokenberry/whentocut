#!/usr/bin/env bash
#
# Non-destructive setup for a SHARED droplet (another app is already running).
# Unlike provision.sh, this script:
#   - does NOT install Node via NodeSource (won't change the system Node the other app uses)
#   - does NOT install or modify Nginx / Postgres
#   - does NOT touch any other app, site, or PM2 process
#   - is idempotent (safe to re-run)
#
# It clones the repo, builds, and starts WhenToCut under PM2 on its own PORT.
# Reverse-proxy + TLS are a separate, additive step (see deploy/nginx/whentocut.conf.example).
#
# Usage:
#   REPO_URL=https://github.com/tokenberry/whentocut.git PORT=3001 ./scripts/setup-shared.sh
set -euo pipefail

APP_DIR="${DEPLOY_DIR:-/opt/whentocut}"
APP_NAME="${PM2_APP_NAME:-whentocut}"
REPO_URL="${REPO_URL:?set REPO_URL to the git clone URL}"
BRANCH="${DEPLOY_BRANCH:-main}"
PORT="${PORT:-3001}"
MIN_NODE_MAJOR=20
export PORT

echo "==> Checking Node (will NOT replace it)"
if ! command -v node > /dev/null 2>&1; then
  echo "ERROR: Node not found. Install Node >= ${MIN_NODE_MAJOR} — using nvm is recommended so"
  echo "       you can add a version for this app WITHOUT changing your other app's default."
  exit 1
fi
NODE_MAJOR="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  echo "ERROR: Node $(node -v) is too old (need >= ${MIN_NODE_MAJOR})."
  echo "       Add a newer Node with nvm for this app only; do not upgrade the system Node"
  echo "       if your other app depends on the current one."
  exit 1
fi
echo "    Node $(node -v) OK"

echo "==> Ensuring PM2 is available (installs only if missing; harmless to other apps)"
if ! command -v pm2 > /dev/null 2>&1; then
  npm install -g pm2
fi

echo "==> Checking port ${PORT} is free"
if command -v ss > /dev/null 2>&1 && ss -tlnH "sport = :${PORT}" 2>/dev/null | grep -q .; then
  echo "ERROR: Port ${PORT} is already in use. Re-run with a different PORT, e.g. PORT=3002 ..."
  exit 1
fi

echo "==> Cloning / updating ${APP_DIR}"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
git fetch --all --prune
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

if [ ! -f .env ]; then
  cp .env.example .env
  if grep -q '^PORT=' .env; then
    sed -i "s/^PORT=.*/PORT=${PORT}/" .env
  else
    echo "PORT=${PORT}" >> .env
  fi
  echo "==> Created .env with PORT=${PORT}. No database required to run."
  echo "    Add STEAMWORKS_PARTNER_KEY later to unlock your private sales/wishlist data."
fi

echo "==> Installing + building"
npm ci
npm run build

echo "==> Starting under PM2 as '${APP_NAME}' on port ${PORT}"
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  pm2 start "npm run start" --name "$APP_NAME"
fi
pm2 save

cat <<EOF

==> Done. WhenToCut is live at http://127.0.0.1:${PORT} (PM2 app '${APP_NAME}').
    Verify:  curl -sI http://127.0.0.1:${PORT}/
    Next (additive, does not touch your other app):
      1. Reverse proxy — copy deploy/nginx/whentocut.conf.example into
         /etc/nginx/sites-available/whentocut.conf, set your subdomain + port, then:
           sudo ln -s /etc/nginx/sites-available/whentocut.conf /etc/nginx/sites-enabled/
           sudo nginx -t && sudo systemctl reload nginx
           sudo certbot --nginx -d whentocut.<your-domain>
      2. Auto-deploy — add GitHub repo secrets DROPLET_HOST/USER/SSH_KEY (see DEPLOY.md).
EOF
