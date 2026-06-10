#!/usr/bin/env bash
set -euo pipefail

: "${FRONTEND_CT:?FRONTEND_CT nao definido}"
: "${FRONTEND_PATH:?FRONTEND_PATH nao definido}"

PACKAGE_PATH="${FRONTEND_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-frontend.tar.gz}"
REMOTE_PACKAGE="/tmp/santilac-frontend-${GITHUB_SHA:-manual}.tar.gz"

pct push "$FRONTEND_CT" "$PACKAGE_PATH" "$REMOTE_PACKAGE"
pct exec "$FRONTEND_CT" -- sh -lc "set -e; mkdir -p \"$FRONTEND_PATH\"; cd \"$FRONTEND_PATH\"; cp -f index.html index.html.bak-\$(date +%Y%m%d%H%M%S) 2>/dev/null || true; tar -xzf \"$REMOTE_PACKAGE\" -C \"$FRONTEND_PATH\"; rm -f \"$REMOTE_PACKAGE\""

if [ -n "${FRONTEND_HEALTH_URL:-}" ]; then
  curl -fsS "$FRONTEND_HEALTH_URL" >/dev/null
fi
