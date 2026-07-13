#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PACKAGE_PATH="${BACKEND_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-backend.tar.gz}"

cd "$ROOT_DIR"

tar -czf "$PACKAGE_PATH" \
  --exclude='backend/.env' \
  --exclude='backend/.env.*' \
  --exclude='backend/vendor' \
  --exclude='backend/node_modules' \
  --exclude='backend/graphify-out' \
  --exclude='backend/storage/logs/*' \
  --exclude='backend/storage/framework/cache/*' \
  --exclude='backend/storage/framework/sessions/*' \
  --exclude='backend/storage/framework/views/*' \
  backend

echo "BACKEND_PACKAGE=$PACKAGE_PATH" >> "${GITHUB_ENV:-/dev/null}"

