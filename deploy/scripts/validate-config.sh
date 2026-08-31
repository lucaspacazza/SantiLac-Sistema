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

if [ "${DEPLOY_PWA_PRODUCAO_BACKEND:-false}" = "true" ]; then
  PWA_PRODUCAO_BACKEND_CT="${PWA_PRODUCAO_BACKEND_CT:-${BACKEND_CT:-101}}"
  PWA_PRODUCAO_BACKEND_PATH="${PWA_PRODUCAO_BACKEND_PATH:-/var/www/santilac-pwa-producao-backend}"
fi

if [ "${DEPLOY_PROCESSOR:-false}" = "true" ]; then
  PROCESSOR_CT="${PROCESSOR_CT:-102}"
  PROCESSOR_PATH="${PROCESSOR_PATH:-/var/www/processor}"
fi

if [ "$missing" -ne 0 ]; then
  echo "Corrija o runner ou preencha os Secrets/Variables em Settings > Secrets and variables > Actions."
  exit 1
fi

echo "Configuração de deploy validada."


