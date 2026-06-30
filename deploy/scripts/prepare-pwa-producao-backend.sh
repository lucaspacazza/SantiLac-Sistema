#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PACKAGE_PATH="${PWA_PRODUCAO_BACKEND_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-pwa-producao-backend.tar.gz}"

cd "$ROOT_DIR"

tar -czf "$PACKAGE_PATH" \
  --exclude='pwa-producao/backend/.env' \
  --exclude='pwa-producao/backend/.env.*' \
  --exclude='pwa-producao/backend/vendor' \
  --exclude='pwa-producao/backend/node_modules' \
  --exclude='pwa-producao/backend/storage/logs/*' \
  --exclude='pwa-producao/backend/storage/framework/cache/*' \
  --exclude='pwa-producao/backend/storage/framework/sessions/*' \
  --exclude='pwa-producao/backend/storage/framework/views/*' \
  pwa-producao/backend

echo "PWA_PRODUCAO_BACKEND_PACKAGE=$PACKAGE_PATH" >> "${GITHUB_ENV:-/dev/null}"
