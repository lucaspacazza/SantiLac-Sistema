#!/usr/bin/env bash
set -euo pipefail

missing=0

require_value() {
  name="$1"
  value="${!name:-}"
  if [ -z "$value" ]; then
    echo "::error title=Configuracao ausente::$name nao foi definido nos Secrets ou Variables do GitHub."
    missing=1
  fi
}

if ! command -v pct >/dev/null 2>&1; then
  echo "::error title=Runner incorreto::Este deploy precisa rodar em um self-hosted runner dentro do Proxmox, com o comando pct disponivel."
  missing=1
fi

if [ "${DEPLOY_FRONTEND:-false}" = "true" ]; then
  FRONTEND_CT="${FRONTEND_CT:-100}"
  FRONTEND_PATH="${FRONTEND_PATH:-/var/www/santilac-front}"
fi

if [ "${DEPLOY_BACKEND:-false}" = "true" ]; then
  BACKEND_CT="${BACKEND_CT:-101}"
  BACKEND_PATH="${BACKEND_PATH:-/var/www/santilac-backend}"
fi

if [ "${DEPLOY_PROCESSOR:-false}" = "true" ]; then
  PROCESSOR_CT="${PROCESSOR_CT:-102}"
  PROCESSOR_PATH="${PROCESSOR_PATH:-/var/www/processor}"
fi

if [ "${DEPLOY_DATABASE:-false}" = "true" ]; then
  DATABASE_CT="${DATABASE_CT:-103}"
  BACKEND_ENV_CT="${BACKEND_ENV_CT:-101}"
  BACKEND_ENV_PATH="${BACKEND_ENV_PATH:-/var/www/santilac-backend/.env}"
  if [ -z "${DB_NAME:-}" ] || [ -z "${DB_USER:-}" ] || [ -z "${DB_PASSWORD:-}" ]; then
    if ! pct exec "$BACKEND_ENV_CT" -- test -f "$BACKEND_ENV_PATH"; then
      echo "::error title=Configuracao ausente::Credenciais do banco nao foram definidas no GitHub e nao encontrei $BACKEND_ENV_PATH no CT $BACKEND_ENV_CT."
      missing=1
    fi
  fi
fi

if [ "$missing" -ne 0 ]; then
  echo "Corrija o runner ou preencha os Secrets/Variables em Settings > Secrets and variables > Actions."
  exit 1
fi

echo "Configuracao de deploy validada."
