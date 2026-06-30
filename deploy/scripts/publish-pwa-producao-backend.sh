#!/usr/bin/env bash
set -euo pipefail

PWA_PRODUCAO_BACKEND_CT="${PWA_PRODUCAO_BACKEND_CT:-${BACKEND_CT:-101}}"
PWA_PRODUCAO_BACKEND_PATH="${PWA_PRODUCAO_BACKEND_PATH:-/var/www/santilac-pwa-producao-backend}"

PACKAGE_PATH="${PWA_PRODUCAO_BACKEND_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-pwa-producao-backend.tar.gz}"
REMOTE_PACKAGE="/tmp/santilac-pwa-producao-backend-${GITHUB_SHA:-manual}.tar.gz"
REMOTE_STAGE="/tmp/santilac-pwa-producao-backend-stage-${GITHUB_SHA:-manual}"

pct push "$PWA_PRODUCAO_BACKEND_CT" "$PACKAGE_PATH" "$REMOTE_PACKAGE"
pct exec "$PWA_PRODUCAO_BACKEND_CT" -- sh -lc "set -e; rm -rf \"$REMOTE_STAGE\"; mkdir -p \"$REMOTE_STAGE\" \"$PWA_PRODUCAO_BACKEND_PATH\"; tar -xzf \"$REMOTE_PACKAGE\" -C \"$REMOTE_STAGE\"; rsync -a --delete --exclude=.env --exclude=vendor --exclude=node_modules --exclude=storage/logs --exclude=storage/framework/cache --exclude=storage/framework/sessions --exclude=storage/framework/views \"$REMOTE_STAGE/pwa-producao/backend/\" \"$PWA_PRODUCAO_BACKEND_PATH/\"; cd \"$PWA_PRODUCAO_BACKEND_PATH\"; if [ ! -f .env ] && [ -f /var/www/santilac-backend/.env ]; then cp /var/www/santilac-backend/.env .env; fi; if command -v composer >/dev/null 2>&1; then composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader; fi; mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache; php artisan optimize:clear || true; php artisan config:cache || true; php artisan route:cache || true; chown -R www-data:www-data storage bootstrap/cache; find storage bootstrap/cache -type d -exec chmod 775 {} +; find storage bootstrap/cache -type f -exec chmod 664 {} +; rm -rf \"$REMOTE_STAGE\" \"$REMOTE_PACKAGE\""

if [ -n "${PWA_PRODUCAO_BACKEND_HEALTH_URL:-}" ]; then
  curl -fsS "$PWA_PRODUCAO_BACKEND_HEALTH_URL" >/dev/null
fi
