#!/usr/bin/env bash
set -euo pipefail

PROCESSOR_CT="${PROCESSOR_CT:-102}"
PROCESSOR_PATH="${PROCESSOR_PATH:-/var/www/processor}"
PASTEURIZADOR_PROCESSOR_PATH="${PASTEURIZADOR_PROCESSOR_PATH:-/opt/santilac-pasteurizador-processor}"

PACKAGE_PATH="${PROCESSOR_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-processor.tar.gz}"
REMOTE_PACKAGE="/tmp/santilac-processor-${GITHUB_SHA:-manual}.tar.gz"
REMOTE_STAGE="/tmp/santilac-processor-stage-${GITHUB_SHA:-manual}"

pct push "$PROCESSOR_CT" "$PACKAGE_PATH" "$REMOTE_PACKAGE"
pct exec "$PROCESSOR_CT" -- sh -lc "set -e; rm -rf \"$REMOTE_STAGE\"; mkdir -p \"$REMOTE_STAGE\" \"$PROCESSOR_PATH\"; tar -xzf \"$REMOTE_PACKAGE\" -C \"$REMOTE_STAGE\"; rsync -a --delete --exclude=.env --exclude=.venv \"$REMOTE_STAGE/processor/\" \"$PROCESSOR_PATH/\"; cd \"$PROCESSOR_PATH\"; if [ \"${PROCESSOR_INSTALL_REQUIREMENTS:-1}\" = \"1\" ] && [ -f requirements.txt ]; then python3 -m venv .venv; . .venv/bin/activate; pip install --upgrade pip; pip install -r requirements.txt; fi; if [ -n \"${PROCESSOR_SERVICES:-}\" ]; then for service in ${PROCESSOR_SERVICES:-}; do systemctl restart \"\$service\"; done; fi; rm -rf \"$REMOTE_STAGE\" \"$REMOTE_PACKAGE\""

pct exec "$PROCESSOR_CT" -- sh -lc "set -e; if [ -d \"$PROCESSOR_PATH/modules/pasteurizador\" ]; then mkdir -p \"$PASTEURIZADOR_PROCESSOR_PATH\"; rsync -a --delete --exclude=systemd \"$PROCESSOR_PATH/modules/pasteurizador/\" \"$PASTEURIZADOR_PROCESSOR_PATH/\"; chmod +x \"$PASTEURIZADOR_PROCESSOR_PATH/collect_and_post.py\" \"$PASTEURIZADOR_PROCESSOR_PATH/trigger_server.py\" || true; if [ -d \"$PROCESSOR_PATH/modules/pasteurizador/systemd\" ]; then cp \"$PROCESSOR_PATH/modules/pasteurizador/systemd/\"*.service \"$PROCESSOR_PATH/modules/pasteurizador/systemd/\"*.timer /etc/systemd/system/; systemctl daemon-reload; systemctl enable santilac-pasteurizador-daily.timer santilac-pasteurizador-trigger.service >/dev/null 2>&1 || true; systemctl restart santilac-pasteurizador-trigger.service || true; systemctl restart santilac-pasteurizador-daily.timer || true; fi; fi"

if [ -n "${PROCESSOR_HEALTH_URL:-}" ]; then
  curl -fsS "$PROCESSOR_HEALTH_URL" >/dev/null
fi