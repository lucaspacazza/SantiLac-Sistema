#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PACKAGE_PATH="${PROCESSOR_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-processor.tar.gz}"

cd "$ROOT_DIR"

tar -czf "$PACKAGE_PATH" \
  --exclude='processor/.env' \
  --exclude='processor/.env.*' \
  --exclude='processor/.venv' \
  --exclude='processor/__pycache__' \
  --exclude='processor/**/__pycache__' \
  processor

echo "PROCESSOR_PACKAGE=$PACKAGE_PATH" >> "${GITHUB_ENV:-/dev/null}"