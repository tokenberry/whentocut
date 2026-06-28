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
# Cap the build's heap so it can't balloon and OOM-kill on a small box.
BUILD_HEAP_MB="${BUILD_HEAP_MB:-1536}"

cd "$APP_DIR"

# Pre-flight: warn loudly if there's no swap and little free RAM. `npm ci`/`next build`
# need headroom; without it the kernel OOM-kills them (exit 137). See SHARED-DROPLET.md.
preflight_memory_check() {
  local swap_total avail_mb
  swap_total="$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
  avail_mb="$(awk '/^MemAvailable:/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo 0)"
  if [ "${swap_total:-0}" -eq 0 ] && [ "${avail_mb:-9999}" -lt 1024 ]; then
    echo "==> WARNING: no swap and only ${avail_mb}MB RAM available — the build may be"
    echo "    OOM-killed. Add swap (see SHARED-DROPLET.md):"
    echo "      fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile \\"
    echo "        && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab"
  fi
}

echo "==> Deploying $APP_NAME from origin/$BRANCH"
preflight_memory_check
git fetch --all --prune
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> Installing dependencies"
npm ci --no-audit --no-fund

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

echo "==> Building (heap cap ${BUILD_HEAP_MB}MB)"
NODE_OPTIONS="--max-old-space-size=${BUILD_HEAP_MB}" npm run build

echo "==> Reloading under PM2"
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  pm2 start "npm run start" --name "$APP_NAME"
fi
pm2 save

echo "==> Deploy complete"
