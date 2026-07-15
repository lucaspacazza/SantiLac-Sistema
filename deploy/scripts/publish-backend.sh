#!/usr/bin/env bash
set -euo pipefail

BACKEND_CT="${BACKEND_CT:-101}"
BACKEND_PATH="${BACKEND_PATH:-/var/www/santilac-backend}"
FRONTEND_CT="${FRONTEND_CT:-100}"
FRONTEND_PATH="${FRONTEND_PATH:-/var/www/santilac-front}"

PACKAGE_PATH="${BACKEND_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-backend.tar.gz}"
REMOTE_PACKAGE="/tmp/santilac-backend-${GITHUB_SHA:-manual}.tar.gz"
REMOTE_STAGE="/tmp/santilac-backend-stage-${GITHUB_SHA:-manual}"
FRONTEND_REMOTE_PACKAGE="/tmp/santilac-backend-downloads-${GITHUB_SHA:-manual}.tar.gz"

pct push "$BACKEND_CT" "$PACKAGE_PATH" "$REMOTE_PACKAGE"
pct exec "$BACKEND_CT" -- sh -lc "set -e; rm -rf \"$REMOTE_STAGE\"; mkdir -p \"$REMOTE_STAGE\" \"$BACKEND_PATH\"; tar -xzf \"$REMOTE_PACKAGE\" -C \"$REMOTE_STAGE\"; rsync -a --delete --exclude=.env --exclude=vendor --exclude=node_modules --exclude=storage/logs --exclude=storage/framework/cache --exclude=storage/framework/sessions --exclude=storage/framework/views \"$REMOTE_STAGE/backend/\" \"$BACKEND_PATH/\"; cd \"$BACKEND_PATH\"; if command -v composer >/dev/null 2>&1; then composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader; fi; mkdir -p bootstrap/cache storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs; chown -R www-data:www-data bootstrap/cache storage; find bootstrap/cache storage -type d -exec chmod 775 {} +; find bootstrap/cache storage -type f -exec chmod 664 {} +; php artisan optimize:clear || true; php artisan config:cache || true; php artisan route:cache || true; rm -rf \"$REMOTE_STAGE\" \"$REMOTE_PACKAGE\""

# O domínio público é servido pelo CT 100. Espelha os APKs e manifestos
# versionados junto ao backend para disponibilizá-los no mesmo deploy.
pct push "$FRONTEND_CT" "$PACKAGE_PATH" "$FRONTEND_REMOTE_PACKAGE"
pct exec "$FRONTEND_CT" -- sh -lc "set -e; stage=\$(mktemp -d); tar -xzf '$FRONTEND_REMOTE_PACKAGE' -C \"\$stage\"; mkdir -p '$FRONTEND_PATH/downloads'; rsync -a \"\$stage/backend/public/downloads/\" '$FRONTEND_PATH/downloads/'; chown -R www-data:www-data '$FRONTEND_PATH/downloads'; rm -rf \"\$stage\" '$FRONTEND_REMOTE_PACKAGE'"

if [ -n "${BACKEND_HEALTH_URL:-}" ]; then
  curl -fsS "$BACKEND_HEALTH_URL" >/dev/null
fi

