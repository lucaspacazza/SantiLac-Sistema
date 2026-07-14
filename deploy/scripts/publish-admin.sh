#!/usr/bin/env bash
set -euo pipefail

ADMIN_FRONTEND_CT="${ADMIN_FRONTEND_CT:-100}"
ADMIN_BACKEND_CT="${ADMIN_BACKEND_CT:-101}"
ADMIN_PATH="${ADMIN_PATH:-/var/www/santilac-admin}"
PACKAGE_PATH="${ADMIN_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-admin.tar.gz}"
REMOTE_PACKAGE="/tmp/santilac-admin-${GITHUB_SHA:-manual}.tar.gz"

pct push "$ADMIN_FRONTEND_CT" "$PACKAGE_PATH" "$REMOTE_PACKAGE"
pct exec "$ADMIN_FRONTEND_CT" -- sh -lc "set -e; stage=\$(mktemp -d); tar -xzf '$REMOTE_PACKAGE' -C \"\$stage\"; mkdir -p '$ADMIN_PATH/frontend' '$ADMIN_PATH/modules'; rsync -a --delete \"\$stage/admin/frontend/\" '$ADMIN_PATH/frontend/'; rsync -a --delete --exclude='*/backend/' \"\$stage/admin/modules/\" '$ADMIN_PATH/modules/'; rm -rf '$ADMIN_PATH/backend' '$ADMIN_PATH/collector' '$ADMIN_PATH/database' '$ADMIN_PATH/deploy' '$ADMIN_PATH/.env'; rm -rf \"\$stage\" '$REMOTE_PACKAGE'"

pct push "$ADMIN_BACKEND_CT" "$PACKAGE_PATH" "$REMOTE_PACKAGE"
pct exec "$ADMIN_BACKEND_CT" -- sh -lc "set -e; stage=\$(mktemp -d); tar -xzf '$REMOTE_PACKAGE' -C \"\$stage\"; mkdir -p '$ADMIN_PATH'; rsync -a --delete --exclude=.env --exclude=frontend --exclude=modules \"\$stage/admin/\" '$ADMIN_PATH/'; mkdir -p '$ADMIN_PATH/modules'; rsync -a --delete --exclude='*/frontend/' \"\$stage/admin/modules/\" '$ADMIN_PATH/modules/'; rm -rf \"\$stage\" '$REMOTE_PACKAGE'; chown -R www-data:www-data '$ADMIN_PATH'; find '$ADMIN_PATH' -type d -exec chmod 755 {} +; find '$ADMIN_PATH' -type f -exec chmod 644 {} +; chmod 640 '$ADMIN_PATH/.env'"

if [ -n "${ADMIN_HEALTH_URL:-}" ]; then
  status="$(curl -sS -o /dev/null -w '%{http_code}' "$ADMIN_HEALTH_URL/api/auth/me")"
  test "$status" = "401" || test "$status" = "200"
fi
