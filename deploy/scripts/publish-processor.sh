#!/usr/bin/env bash
set -euo pipefail

PROCESSOR_CT="${PROCESSOR_CT:-102}"
PROCESSOR_PATH="${PROCESSOR_PATH:-/var/www/processor}"

PACKAGE_PATH="${PROCESSOR_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-processor.tar.gz}"
REMOTE_PACKAGE="/tmp/santilac-processor-${GITHUB_SHA:-manual}.tar.gz"
REMOTE_STAGE="/tmp/santilac-processor-stage-${GITHUB_SHA:-manual}"

pct push "$PROCESSOR_CT" "$PACKAGE_PATH" "$REMOTE_PACKAGE"
pct exec "$PROCESSOR_CT" -- sh -lc "set -e; rm -rf \"$REMOTE_STAGE\"; mkdir -p \"$REMOTE_STAGE\" \"$PROCESSOR_PATH\"; tar -xzf \"$REMOTE_PACKAGE\" -C \"$REMOTE_STAGE\"; rsync -a --delete --exclude=.env --exclude=.venv \"$REMOTE_STAGE/processor/\" \"$PROCESSOR_PATH/\"; cd \"$PROCESSOR_PATH\"; if [ \"${PROCESSOR_INSTALL_REQUIREMENTS:-0}\" = \"1\" ] && [ -f requirements.txt ]; then python3 -m venv .venv; . .venv/bin/activate; pip install -r requirements.txt; fi; if [ -n \"${PROCESSOR_SERVICES:-}\" ]; then for service in ${PROCESSOR_SERVICES:-}; do systemctl restart \"\$service\"; done; fi; rm -rf \"$REMOTE_STAGE\" \"$REMOTE_PACKAGE\""

if [ -n "${PROCESSOR_HEALTH_URL:-}" ]; then
  curl -fsS "$PROCESSOR_HEALTH_URL" >/dev/null
fi
