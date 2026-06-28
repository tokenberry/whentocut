#!/usr/bin/env bash
#
# One-time droplet bootstrap (run as root or with sudo on a fresh Ubuntu droplet).
# Installs Node 22, PM2, Postgres, clones the repo, and prepares the app dir so that
# subsequent GitHub Actions deploys (scripts/deploy.sh) just work.
#
# Usage: REPO_URL=https://github.com/tokenberry/whentocut.git ./scripts/provision.sh
set -euo pipefail

APP_DIR="${DEPLOY_DIR:-/opt/whentocut}"
REPO_URL="${REPO_URL:?set REPO_URL to the git clone URL}"
BRANCH="${DEPLOY_BRANCH:-main}"
NODE_MAJOR="${NODE_MAJOR:-22}"

echo "==> Installing Node ${NODE_MAJOR}, git, nginx, postgres"
curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
apt-get install -y nodejs git nginx postgresql postgresql-contrib

echo "==> Installing PM2"
npm install -g pm2

echo "==> Cloning repo into ${APP_DIR}"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
git checkout "$BRANCH"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Created .env from template — EDIT IT before first deploy (DATABASE_URL, STEAMWORKS_PARTNER_KEY, etc.)"
fi

echo "==> Enabling PM2 on boot"
pm2 startup systemd -u "$(whoami)" --hp "$HOME" || true

cat <<'EOF'

==> Provision complete. Next steps:
  1. Edit /opt/whentocut/.env  (DATABASE_URL, STEAMWORKS_PARTNER_KEY, CRON_SECRET, ...)
  2. Create the Postgres DB/user (see DEPLOY.md), then run:  ./scripts/deploy.sh <branch>
  3. Add GitHub repo secrets (DROPLET_HOST, DROPLET_USER, DROPLET_SSH_KEY) — see DEPLOY.md
  4. Configure Nginx + TLS (see DEPLOY.md)
EOF
