#!/usr/bin/env bash
set -euo pipefail

: "${PROCESSOR_CT:?PROCESSOR_CT nao definido}"
: "${PROCESSOR_PATH:?PROCESSOR_PATH nao definido}"

PACKAGE_PATH="${PROCESSOR_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-processor.tar.gz}"
REMOTE_PACKAGE="/tmp/santilac-processor-${GITHUB_SHA:-manual}.tar.gz"
REMOTE_STAGE="/tmp/santilac-processor-stage-${GITHUB_SHA:-manual}"

scp "$PACKAGE_PATH" "santilac-deploy:$REMOTE_PACKAGE"

ssh santilac-deploy "pct push '$PROCESSOR_CT' '$REMOTE_PACKAGE' '$REMOTE_PACKAGE'"
ssh santilac-deploy "pct exec '$PROCESSOR_CT' -- sh -lc 'set -e; rm -rf \"$REMOTE_STAGE\"; mkdir -p \"$REMOTE_STAGE\" \"$PROCESSOR_PATH\"; tar -xzf \"$REMOTE_PACKAGE\" -C \"$REMOTE_STAGE\"; rsync -a --delete --exclude=.env --exclude=.venv \"$REMOTE_STAGE/processor/\" \"$PROCESSOR_PATH/\"; cd \"$PROCESSOR_PATH\"; if [ \"${PROCESSOR_INSTALL_REQUIREMENTS:-0}\" = \"1\" ] && [ -f requirements.txt ]; then python3 -m venv .venv; . .venv/bin/activate; pip install -r requirements.txt; fi; if [ -n \"${PROCESSOR_SERVICES:-}\" ]; then for service in ${PROCESSOR_SERVICES:-}; do systemctl restart \"$service\"; done; fi; rm -rf \"$REMOTE_STAGE\" \"$REMOTE_PACKAGE\"'"
ssh santilac-deploy "rm -f '$REMOTE_PACKAGE'"

if [ -n "${PROCESSOR_HEALTH_URL:-}" ]; then
  curl -fsS "$PROCESSOR_HEALTH_URL" >/dev/null
fi
