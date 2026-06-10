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
  require_value FRONTEND_CT
  require_value FRONTEND_PATH
fi

if [ "${DEPLOY_BACKEND:-false}" = "true" ]; then
  require_value BACKEND_CT
  require_value BACKEND_PATH
fi

if [ "${DEPLOY_PROCESSOR:-false}" = "true" ]; then
  require_value PROCESSOR_CT
  require_value PROCESSOR_PATH
fi

if [ "${DEPLOY_DATABASE:-false}" = "true" ]; then
  require_value DATABASE_CT
  require_value DB_NAME
  require_value DB_USER
  require_value DB_PASSWORD
fi

if [ "$missing" -ne 0 ]; then
  echo "Corrija o runner ou preencha os Secrets/Variables em Settings > Secrets and variables > Actions."
  exit 1
fi

echo "Configuracao de deploy validada."
