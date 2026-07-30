#!/usr/bin/env bash
set -euo pipefail

PROCESSOR_CT="${PROCESSOR_CT:-102}"
PROCESSOR_PATH="${PROCESSOR_PATH:-/var/www/processor}"
PASTEURIZADOR_PROCESSOR_PATH="${PASTEURIZADOR_PROCESSOR_PATH:-/opt/santilac-pasteurizador-processor}"
PROCESSOR_INSTALL_REQUIREMENTS="${PROCESSOR_INSTALL_REQUIREMENTS:-1}"
PROCESSOR_SERVICES="${PROCESSOR_SERVICES:-}"
PASTEURIZADOR_API_BACKEND_CT="${PASTEURIZADOR_API_BACKEND_CT:-101}"
PASTEURIZADOR_API_BACKEND_ENV="${PASTEURIZADOR_API_BACKEND_ENV:-/var/www/santilac-backend/.env}"

PACKAGE_PATH="${PROCESSOR_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-processor.tar.gz}"
REMOTE_PACKAGE="/tmp/santilac-processor-${GITHUB_SHA:-manual}.tar.gz"
REMOTE_STAGE="/tmp/santilac-processor-stage-${GITHUB_SHA:-manual}"
REMOTE_TOKEN_FILE="/tmp/santilac-pasteurizador-token-${GITHUB_SHA:-manual}"
PROCESSOR_TOKEN_BACKUP="/etc/santilac-pasteurizador/api-token"

LOCAL_TOKEN_FILE=""
RUNTIME_ENV_ARGS=""
cleanup_token_files() {
  if [ -n "$LOCAL_TOKEN_FILE" ]; then
    rm -f "$LOCAL_TOKEN_FILE"
    pct exec "$PROCESSOR_CT" -- rm -f "$REMOTE_TOKEN_FILE" >/dev/null 2>&1 || true
  fi
}
trap cleanup_token_files EXIT

if [ "$PROCESSOR_CT" = "102" ]; then
  umask 077
  LOCAL_TOKEN_FILE="$(mktemp "${RUNNER_TEMP:-/tmp}/santilac-pasteurizador-token.XXXXXX")"

  # Producao: CT 102 -> API do CT 101 -> unico banco 192.168.5.204.
  # A credencial primaria vem do backend; a copia local permite recuperacao
  # mesmo se o backend estiver temporariamente indisponivel durante o deploy.
  token_from_backend=1
  if ! pct exec "$PASTEURIZADOR_API_BACKEND_CT" -- sh -lc \
    "set -e; test -r '$PASTEURIZADOR_API_BACKEND_ENV'; sed -n 's/^SANTILAC_API_KEY=//p' '$PASTEURIZADOR_API_BACKEND_ENV' | tail -n 1" \
    > "$LOCAL_TOKEN_FILE"; then
    token_from_backend=0
  fi

  if [ "$token_from_backend" != "1" ] || ! grep -q '[^[:space:]]' "$LOCAL_TOKEN_FILE"; then
    echo 'Aviso: credencial primaria indisponivel; usando copia protegida do processador de producao.' >&2
    : > "$LOCAL_TOKEN_FILE"
    if ! pct exec "$PROCESSOR_CT" -- sh -lc \
      "set -e; if [ -s '$PROCESSOR_TOKEN_BACKUP' ]; then cat '$PROCESSOR_TOKEN_BACKUP'; else sed -n 's/^SANTILAC_API_TOKEN=//p' /etc/santilac-pasteurizador/processor.env | tail -n 1; fi" \
      > "$LOCAL_TOKEN_FILE" || ! grep -q '[^[:space:]]' "$LOCAL_TOKEN_FILE"; then
      echo 'Erro: credencial de producao ausente tanto no backend 101 quanto no backup do processor 102.' >&2
      exit 1
    fi
  fi

  pct push "$PROCESSOR_CT" "$LOCAL_TOKEN_FILE" "$REMOTE_TOKEN_FILE" --perms 0600
  RUNTIME_ENV_ARGS="--production --token-file $REMOTE_TOKEN_FILE --persist-token-file $PROCESSOR_TOKEN_BACKUP"
fi

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

pct exec "$PROCESSOR_CT" -- sh -lc "set -e; if [ -d \"$PROCESSOR_PATH/modules/pasteurizador\" ]; then mkdir -p \"$PASTEURIZADOR_PROCESSOR_PATH\"; rsync -a --delete --exclude=systemd \"$PROCESSOR_PATH/modules/pasteurizador/\" \"$PASTEURIZADOR_PROCESSOR_PATH/\"; chmod +x \"$PASTEURIZADOR_PROCESSOR_PATH/collect_and_post.py\" \"$PASTEURIZADOR_PROCESSOR_PATH/trigger_server.py\" \"$PASTEURIZADOR_PROCESSOR_PATH/ensure_runtime_env.py\" || true; mkdir -p /etc/santilac-pasteurizador; /usr/bin/python3 \"$PASTEURIZADOR_PROCESSOR_PATH/ensure_runtime_env.py\" --path /etc/santilac-pasteurizador/processor.env $RUNTIME_ENV_ARGS; rm -f \"$REMOTE_TOKEN_FILE\"; if [ -d \"$PROCESSOR_PATH/modules/pasteurizador/systemd\" ]; then cp \"$PROCESSOR_PATH/modules/pasteurizador/systemd/\"*.service \"$PROCESSOR_PATH/modules/pasteurizador/systemd/\"*.timer /etc/systemd/system/; if [ \"$PROCESSOR_CT\" = \"102\" ]; then mkdir -p /etc/systemd/system/santilac-pasteurizador-daily.timer.d; cp \"$PROCESSOR_PATH/modules/pasteurizador/systemd/santilac-pasteurizador-production-redundancy.conf\" /etc/systemd/system/santilac-pasteurizador-daily.timer.d/production-redundancy.conf; fi; systemctl daemon-reload; systemctl enable santilac-pasteurizador-daily.timer santilac-pasteurizador-trigger.service >/dev/null 2>&1 || true; systemctl restart santilac-pasteurizador-trigger.service; systemctl restart santilac-pasteurizador-daily.timer; if [ \"$PROCESSOR_CT\" = \"102\" ]; then systemctl restart santilac-pasteurizador-daily.service; fi; fi; fi"

if [ -n "${PROCESSOR_HEALTH_URL:-}" ]; then
  curl -fsS "$PROCESSOR_HEALTH_URL" >/dev/null
fi
