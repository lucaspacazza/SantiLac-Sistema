#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PACKAGE_PATH="${ADMIN_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-admin.tar.gz}"
cd "$ROOT_DIR"
tar -czf "$PACKAGE_PATH" --exclude='admin/.env' --exclude='admin/.env.*' admin
echo "ADMIN_PACKAGE=$PACKAGE_PATH" >> "${GITHUB_ENV:-/dev/null}"
