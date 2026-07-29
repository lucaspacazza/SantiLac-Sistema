#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly FIELDLOGGER_CORE="$REPOSITORY_ROOT/processor/modules/pasteurizador/fieldlogger_core.py"

find_command() {
  local preferred="$1"
  shift
  local candidate

  if [[ -n "$preferred" ]]; then
    command -v "$preferred" >/dev/null 2>&1 &&
      "$preferred" --version >/dev/null 2>&1 ||
      {
        printf 'Comando configurado nao esta executavel: %s\n' "$preferred" >&2
        return 1
      }
    printf '%s' "$preferred"
    return 0
  fi

  for candidate in "$@"; do
    if command -v "$candidate" >/dev/null 2>&1 &&
      "$candidate" --version >/dev/null 2>&1; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

python_command="$(find_command "${PYTHON_BIN:-}" python3 python)" ||
  {
    printf 'Python 3 nao encontrado.\n' >&2
    exit 1
  }
php_command="$(find_command "${PHP_BIN:-}" php)" ||
  {
    printf 'PHP nao encontrado.\n' >&2
    exit 1
  }

printf '==> Contratos do migrador da rede de testes\n'
bash "$REPOSITORY_ROOT/deploy/tests/test-migrate-test-network.sh"

printf '\n==> Invariante do IP fixo do FieldLogger\n'
grep -Fqx 'DEFAULT_HOST = "192.168.5.101"' "$FIELDLOGGER_CORE" ||
  {
    printf 'O IP do FieldLogger na nova bridge deve permanecer 192.168.5.101.\n' >&2
    exit 1
  }

printf '\n==> Testes unitarios do processador do pasteurizador\n'
"$python_command" -m unittest discover \
  -s "$REPOSITORY_ROOT/processor/modules/pasteurizador/tests" \
  -p 'test_*.py' \
  -v

printf '\n==> Contrato de timeout do backend do pasteurizador\n'
"$php_command" "$REPOSITORY_ROOT/backend/tests/pasteurizer_processor_timeout_contract_test.php"

printf '\nGates locais do deploy de testes: OK.\n'
