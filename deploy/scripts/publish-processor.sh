#!/usr/bin/env bash
set -euo pipefail

PROCESSOR_CT="${PROCESSOR_CT:-102}"
PROCESSOR_PATH="${PROCESSOR_PATH:-/var/www/processor}"
PASTEURIZADOR_PROCESSOR_PATH="${PASTEURIZADOR_PROCESSOR_PATH:-/opt/santilac-pasteurizador-processor}"
PROCESSOR_INSTALL_REQUIREMENTS="${PROCESSOR_INSTALL_REQUIREMENTS:-1}"
PROCESSOR_SERVICES="${PROCESSOR_SERVICES:-}"

PACKAGE_PATH="${PROCESSOR_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-processor.tar.gz}"
REMOTE_PACKAGE="/tmp/santilac-processor-${GITHUB_SHA:-manual}.tar.gz"
REMOTE_STAGE="/tmp/santilac-processor-stage-${GITHUB_SHA:-manual}"

REMOTE_DEPLOY_CMD=$(cat <<EOF
set -e
rm -rf "$REMOTE_STAGE"
mkdir -p "$REMOTE_STAGE" "$PROCESSOR_PATH"
tar -xzf "$REMOTE_PACKAGE" -C "$REMOTE_STAGE"
rsync -a --delete --exclude=.env --exclude=.venv "$REMOTE_STAGE/processor/" "$PROCESSOR_PATH/"
cd "$PROCESSOR_PATH"

install_requirements() {
  if [ "$PROCESSOR_INSTALL_REQUIREMENTS" != "1" ] || [ ! -f requirements.txt ]; then
    return 0
  fi

  create_venv() {
    python3 -m venv .venv >/dev/null 2>&1
  }

  install_into_venv() {
    . .venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
  }

  if create_venv; then
    install_into_venv
    return 0
  fi

  echo 'python3-venv indisponivel; tentando instalar no container.'
  if command -v apt-get >/dev/null 2>&1; then
    py_minor="\$(python3 -c 'import sys; print("{}.{}".format(sys.version_info[0], sys.version_info[1]))' 2>/dev/null || true)"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y python3-venv || {
      if [ -n "\$py_minor" ]; then
        apt-get install -y "python\$py_minor-venv"
      else
        false
      fi
    }
    rm -rf .venv
    if create_venv; then
      install_into_venv
      return 0
    fi
  fi

  echo 'Nao foi possivel criar .venv; usando pip do sistema como ultimo recurso.'
  if python3 -m pip --version >/dev/null 2>&1; then
    PIP_BREAK_SYSTEM_PACKAGES=1 python3 -m pip install --upgrade pip
    PIP_BREAK_SYSTEM_PACKAGES=1 python3 -m pip install -r requirements.txt
  elif command -v pip3 >/dev/null 2>&1; then
    PIP_BREAK_SYSTEM_PACKAGES=1 pip3 install --upgrade pip
    PIP_BREAK_SYSTEM_PACKAGES=1 pip3 install -r requirements.txt
  else
    echo 'Erro: nem python3 -m pip nem pip3 estao disponiveis no container do processor.' >&2
    exit 1
  fi
}

restart_processor_services() {
  if [ -n "$PROCESSOR_SERVICES" ]; then
    for service in $PROCESSOR_SERVICES; do
      systemctl restart "\$service"
    done
    return 0
  fi

  if systemctl list-unit-files 2>/dev/null | grep -q '^santilac-processor\.service'; then
    systemctl restart santilac-processor.service
  fi
}

install_requirements
restart_processor_services
rm -rf "$REMOTE_STAGE" "$REMOTE_PACKAGE"
EOF
)

pct push "$PROCESSOR_CT" "$PACKAGE_PATH" "$REMOTE_PACKAGE"
pct exec "$PROCESSOR_CT" -- sh -lc "$REMOTE_DEPLOY_CMD"

pct exec "$PROCESSOR_CT" -- sh -lc "set -e; if [ -d \"$PROCESSOR_PATH/modules/pasteurizador\" ]; then mkdir -p \"$PASTEURIZADOR_PROCESSOR_PATH\"; rsync -a --delete --exclude=systemd \"$PROCESSOR_PATH/modules/pasteurizador/\" \"$PASTEURIZADOR_PROCESSOR_PATH/\"; chmod +x \"$PASTEURIZADOR_PROCESSOR_PATH/collect_and_post.py\" \"$PASTEURIZADOR_PROCESSOR_PATH/trigger_server.py\" || true; if [ -d \"$PROCESSOR_PATH/modules/pasteurizador/systemd\" ]; then cp \"$PROCESSOR_PATH/modules/pasteurizador/systemd/\"*.service \"$PROCESSOR_PATH/modules/pasteurizador/systemd/\"*.timer /etc/systemd/system/; systemctl daemon-reload; systemctl enable santilac-pasteurizador-daily.timer santilac-pasteurizador-trigger.service >/dev/null 2>&1 || true; systemctl restart santilac-pasteurizador-trigger.service || true; systemctl restart santilac-pasteurizador-daily.timer || true; fi; fi"

if [ -n "${PROCESSOR_HEALTH_URL:-}" ]; then
  curl -fsS "$PROCESSOR_HEALTH_URL" >/dev/null
fi
