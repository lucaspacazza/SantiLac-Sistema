#!/usr/bin/env bash
set -euo pipefail

BACKEND_CT="${BACKEND_CT:-101}"
BACKEND_PATH="${BACKEND_PATH:-/var/www/santilac-backend}"

PACKAGE_PATH="${BACKEND_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-backend.tar.gz}"
REMOTE_PACKAGE="/tmp/santilac-backend-${GITHUB_SHA:-manual}.tar.gz"
REMOTE_STAGE="/tmp/santilac-backend-stage-${GITHUB_SHA:-manual}"

pct push "$BACKEND_CT" "$PACKAGE_PATH" "$REMOTE_PACKAGE"
pct exec "$BACKEND_CT" -- sh -lc "set -e; rm -rf \"$REMOTE_STAGE\"; mkdir -p \"$REMOTE_STAGE\" \"$BACKEND_PATH\"; tar -xzf \"$REMOTE_PACKAGE\" -C \"$REMOTE_STAGE\"; rsync -a --delete --exclude=.env --exclude=vendor --exclude=node_modules --exclude=storage/logs --exclude=storage/framework/cache --exclude=storage/framework/sessions --exclude=storage/framework/views \"$REMOTE_STAGE/backend/\" \"$BACKEND_PATH/\"; cd \"$BACKEND_PATH\"; if command -v composer >/dev/null 2>&1; then composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader; fi; php artisan optimize:clear || true; php artisan config:cache || true; php artisan route:cache || true; rm -rf \"$REMOTE_STAGE\" \"$REMOTE_PACKAGE\""

if [ -n "${BACKEND_HEALTH_URL:-}" ]; then
  curl -fsS "$BACKEND_HEALTH_URL" >/dev/null
fi
