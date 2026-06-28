#!/usr/bin/env bash
#
# Runs ON the droplet (invoked by .github/workflows/deploy.yml over SSH, or by hand).
# Pulls the given branch, installs, migrates, builds, and reloads the app under PM2.
#
# Usage: ./scripts/deploy.sh [branch]   (defaults to current branch)
set -euo pipefail

APP_DIR="${DEPLOY_DIR:-/opt/whentocut}"
APP_NAME="${PM2_APP_NAME:-whentocut}"
BRANCH="${1:-$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)}"

cd "$APP_DIR"

echo "==> Deploying $APP_NAME from origin/$BRANCH"
git fetch --all --prune
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> Installing dependencies"
npm ci

# Load .env so we can tell whether a database is configured.
set -a
[ -f .env ] && . ./.env
set +a

if [ -n "${DATABASE_URL:-}" ]; then
  echo "==> Applying database migrations"
  npx prisma migrate deploy
else
  echo "==> DATABASE_URL not set — skipping migrations"
fi

echo "==> Building"
npm run build

echo "==> Reloading under PM2"
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  pm2 start "npm run start" --name "$APP_NAME"
fi
pm2 save

echo "==> Deploy complete"
