#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PACKAGE_PATH="${DATABASE_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-database.tar.gz}"

cd "$ROOT_DIR"

if [ ! -d database/migrations ]; then
  echo "Pasta database/migrations nao existe. Nada para empacotar."
  mkdir -p "${RUNNER_TEMP:-/tmp}/empty-database/migrations"
  tar -czf "$PACKAGE_PATH" -C "${RUNNER_TEMP:-/tmp}/empty-database" database 2>/dev/null || tar -czf "$PACKAGE_PATH" -T /dev/null
else
  tar -czf "$PACKAGE_PATH" database/migrations
fi

echo "DATABASE_PACKAGE=$PACKAGE_PATH" >> "${GITHUB_ENV:-/dev/null}"
