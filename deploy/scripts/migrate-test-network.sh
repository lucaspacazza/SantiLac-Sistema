#!/usr/bin/env bash
set -euo pipefail

readonly TARGET_GATEWAY="192.168.5.1"
readonly LEGACY_GATEWAY="192.168.0.1"
readonly PREFIX_LENGTH="24"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly REMOTE_ENV_HELPER="$SCRIPT_DIR/lib/migrate-test-env-file.sh"

readonly -a TEST_CTS=("120" "121" "122")
declare -Ar LEGACY_IPS=(
  ["120"]="192.168.0.120/${PREFIX_LENGTH}"
  ["121"]="192.168.0.121/${PREFIX_LENGTH}"
  ["122"]="192.168.0.122/${PREFIX_LENGTH}"
)
declare -Ar TARGET_IPS=(
  ["120"]="192.168.5.120/${PREFIX_LENGTH}"
  ["121"]="192.168.5.121/${PREFIX_LENGTH}"
  ["122"]="192.168.5.122/${PREFIX_LENGTH}"
)
readonly -a ENV_CTS=("121" "121" "122" "122")
readonly -a ENV_PATHS=(
  "/var/www/santilac-backend/.env"
  "/var/www/santilac-pwa-producao-backend/.env"
  "/etc/santilac-pasteurizador/processor.env"
  "/var/www/processor/.env"
)
readonly -a ENV_PROFILES=(
  "backend"
  "backend"
  "processor"
  "processor-optional"
)
readonly -a ENV_REQUIRED_FILES=("1" "0" "1" "0")

MODE="dry-run"
MODE_WAS_SET="0"
CHECK_CONNECTIVITY="0"
BACKUP_DIR="${TEST_NETWORK_BACKUP_DIR:-$REPOSITORY_ROOT/deploy/network-backups}"

usage() {
  cat <<'EOF'
Uso:
  bash deploy/scripts/migrate-test-network.sh [--dry-run]
  bash deploy/scripts/migrate-test-network.sh --check [--connectivity]
  bash deploy/scripts/migrate-test-network.sh --apply [--backup-dir DIRETORIO]

Modos:
  --dry-run  Valida o estado e mostra as mudancas. E o modo padrao e nao escreve.
  --check    Exige que os CTs 120/121/122 ja estejam na rede esperada. Nao escreve.
  --apply    Migra ip/gw e hosts conhecidos nos envs depois do preflight e backups.
  --connectivity  Com --check, testa TCP para DB, backend, processor e FieldLogger.

O script aceita apenas o estado legado conhecido ou o estado final esperado. Bridge,
MAC, firewall, VLAN, MTU, rate, type e quaisquer outras opcoes do net0 sao preservados.
Os hosts conhecidos nos .env vivos sao migrados sem imprimir segredos. O script nao
reinicia containers. O FieldLogger tambem migra do legado 192.168.0.101 para
192.168.5.101, conforme a nova bridge.
EOF
}

die() {
  printf 'ERRO: %s\n' "$*" >&2
  exit 1
}

set_mode() {
  local requested="$1"
  if [[ "$MODE_WAS_SET" == "1" ]]; then
    die "informe apenas um modo entre --dry-run, --check e --apply"
  fi
  MODE="$requested"
  MODE_WAS_SET="1"
}

while (($# > 0)); do
  case "$1" in
    --dry-run)
      set_mode "dry-run"
      shift
      ;;
    --check)
      set_mode "check"
      shift
      ;;
    --apply)
      set_mode "apply"
      shift
      ;;
    --backup-dir)
      (($# >= 2)) || die "--backup-dir exige um diretorio"
      [[ -n "$2" ]] || die "--backup-dir nao pode ser vazio"
      BACKUP_DIR="$2"
      shift 2
      ;;
    --connectivity)
      CHECK_CONNECTIVITY="1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "argumento desconhecido: $1"
      ;;
  esac
done

if [[ "$CHECK_CONNECTIVITY" == "1" && "$MODE" != "check" ]]; then
  die "--connectivity so pode ser usado com --check"
fi

command -v pct >/dev/null 2>&1 || die "pct nao esta disponivel; execute no host Proxmox"
[[ -r "$REMOTE_ENV_HELPER" ]] ||
  die "helper de migracao dos envs nao encontrado: ${REMOTE_ENV_HELPER}"

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

read_net0() {
  local ct="$1"
  local config
  local -a lines=()

  if ! config="$(pct config "$ct")"; then
    die "nao foi possivel ler a configuracao do CT ${ct}"
  fi

  mapfile -t lines < <(
    printf '%s\n' "$config" |
      sed -n 's/^net0:[[:space:]]*//p'
  )

  if ((${#lines[@]} != 1)); then
    die "CT ${ct}: esperado exatamente um net0; encontrados ${#lines[@]}"
  fi
  [[ -n "${lines[0]}" ]] || die "CT ${ct}: net0 vazio"

  printf '%s' "${lines[0]}"
}

option_value() {
  local ct="$1"
  local net0="$2"
  local wanted_key="$3"
  local raw field key value
  local found="0"
  local -a fields=()

  IFS=',' read -r -a fields <<<"$net0"
  for raw in "${fields[@]}"; do
    field="$(trim "$raw")"
    [[ "$field" == *=* ]] || continue
    key="${field%%=*}"
    value="${field#*=}"
    if [[ "$key" == "$wanted_key" ]]; then
      found=$((found + 1))
      if ((found > 1)); then
        die "CT ${ct}: opcao ${wanted_key} duplicada no net0"
      fi
      printf '%s' "$value"
    fi
  done

  ((found == 1)) || die "CT ${ct}: opcao ${wanted_key} ausente no net0"
}

replace_ip_and_gateway() {
  local ct="$1"
  local net0="$2"
  local target_ip="$3"
  local raw field key
  local replaced_ip="0"
  local replaced_gateway="0"
  local joined=""
  local -a fields=()
  local -a updated=()

  IFS=',' read -r -a fields <<<"$net0"
  for raw in "${fields[@]}"; do
    field="$(trim "$raw")"
    [[ -n "$field" ]] || die "CT ${ct}: opcao vazia no net0"
    key="${field%%=*}"
    case "$key" in
      ip)
        replaced_ip=$((replaced_ip + 1))
        updated+=("ip=${target_ip}")
        ;;
      gw)
        replaced_gateway=$((replaced_gateway + 1))
        updated+=("gw=${TARGET_GATEWAY}")
        ;;
      *)
        updated+=("$field")
        ;;
    esac
  done

  ((replaced_ip == 1)) || die "CT ${ct}: esperado um ip no net0"
  ((replaced_gateway == 1)) || die "CT ${ct}: esperado um gw no net0"

  printf -v joined '%s,' "${updated[@]}"
  printf '%s' "${joined%,}"
}

preserved_options_signature() {
  local net0="$1"
  local raw field key
  local -a fields=()
  local -a preserved=()

  IFS=',' read -r -a fields <<<"$net0"
  for raw in "${fields[@]}"; do
    field="$(trim "$raw")"
    key="${field%%=*}"
    if [[ "$key" != "ip" && "$key" != "gw" ]]; then
      preserved+=("$field")
    fi
  done

  ((${#preserved[@]} > 0)) || die "net0 sem opcoes preservaveis"
  printf '%s\n' "${preserved[@]}" | LC_ALL=C sort
}

run_env_helper() {
  local mode="$1"
  local ct="$2"
  local env_path="$3"
  local profile="$4"
  local required_file="$5"
  local backup_suffix="${6:-not-applicable}"

  pct exec "$ct" -- env \
    "ENV_FILE=${env_path}" \
    "ENV_PROFILE=${profile}" \
    "ENV_REQUIRED_FILE=${required_file}" \
    "ENV_MODE=${mode}" \
    "BACKUP_SUFFIX=${backup_suffix}" \
    sh -s <"$REMOTE_ENV_HELPER"
}

declare -a APPLY_ENV_ATTEMPTS=()
declare -a APPLY_NETWORK_ATTEMPTS=()
ROLLBACK_ARMED="0"

rollback_apply() {
  local original_status="$1"
  local rollback_failures="0"
  local position ct live_net0 current_ip current_gateway current_signature
  local index restore_result

  trap - EXIT HUP INT TERM
  if [[ "$original_status" == "0" || "$ROLLBACK_ARMED" != "1" ]]; then
    return
  fi

  # Rollback is best effort, but every target is validated before it is
  # overwritten. Backups are intentionally retained for manual recovery.
  set +e
  printf '\nFalha durante --apply; iniciando rollback automatico seguro...\n' >&2

  for ((position = ${#APPLY_NETWORK_ATTEMPTS[@]} - 1; position >= 0; position--)); do
    ct="${APPLY_NETWORK_ATTEMPTS[$position]}"
    if ! live_net0="$(read_net0 "$ct")"; then
      printf '[rollback-erro] CT %s: nao foi possivel reler net0; backup preservado.\n' \
        "$ct" >&2
      rollback_failures=$((rollback_failures + 1))
      continue
    fi

    if [[ "$live_net0" == "${ORIGINAL_NET0[$ct]}" ]]; then
      printf '[rollback-ok] CT %s: net0 ja estava no estado original.\n' "$ct" >&2
      continue
    fi

    if ! current_ip="$(option_value "$ct" "$live_net0" "ip")" ||
      ! current_gateway="$(option_value "$ct" "$live_net0" "gw")" ||
      ! current_signature="$(preserved_options_signature "$live_net0")"; then
      printf '[rollback-erro] CT %s: net0 invalido; estado desconhecido nao foi sobrescrito.\n' \
        "$ct" >&2
      rollback_failures=$((rollback_failures + 1))
      continue
    fi

    if [[ "$current_ip" != "${TARGET_IPS[$ct]}" ||
      "$current_gateway" != "$TARGET_GATEWAY" ||
      "$current_signature" != "${ORIGINAL_SIGNATURE[$ct]}" ]]; then
      printf '[rollback-erro] CT %s: net0 mudou concorrentemente; rollback recusado.\n' \
        "$ct" >&2
      rollback_failures=$((rollback_failures + 1))
      continue
    fi

    if ! pct set "$ct" -net0 "${ORIGINAL_NET0[$ct]}"; then
      printf '[rollback-erro] CT %s: pct set do estado original falhou.\n' "$ct" >&2
      rollback_failures=$((rollback_failures + 1))
      continue
    fi
    if ! live_net0="$(read_net0 "$ct")" ||
      [[ "$live_net0" != "${ORIGINAL_NET0[$ct]}" ]]; then
      printf '[rollback-erro] CT %s: verificacao do net0 restaurado falhou.\n' "$ct" >&2
      rollback_failures=$((rollback_failures + 1))
      continue
    fi
    printf '[rollback-ok] CT %s: net0 original restaurado.\n' "$ct" >&2
  done

  for ((position = ${#APPLY_ENV_ATTEMPTS[@]} - 1; position >= 0; position--)); do
    index="${APPLY_ENV_ATTEMPTS[$position]}"
    if ! restore_result="$(
      run_env_helper \
        "restore" \
        "${ENV_CTS[$index]}" \
        "${ENV_PATHS[$index]}" \
        "${ENV_PROFILES[$index]}" \
        "${ENV_REQUIRED_FILES[$index]}" \
        "$migration_id"
    )"; then
      printf '[rollback-erro] CT %s: env %s nao foi sobrescrito; backup adjacente preservado.\n' \
        "${ENV_CTS[$index]}" "${ENV_PATHS[$index]}" >&2
      rollback_failures=$((rollback_failures + 1))
      continue
    fi
    case "${restore_result%%|*}" in
      restored|unchanged)
        printf '[rollback-ok] CT %s: env %s restaurado/verificado.\n' \
          "${ENV_CTS[$index]}" "${ENV_PATHS[$index]}" >&2
        ;;
      *)
        printf '[rollback-erro] CT %s: resposta inesperada ao restaurar %s.\n' \
          "${ENV_CTS[$index]}" "${ENV_PATHS[$index]}" >&2
        rollback_failures=$((rollback_failures + 1))
        ;;
    esac
  done

  if ((rollback_failures == 0)); then
    printf 'Rollback automatico concluido; backups foram mantidos.\n' >&2
  else
    printf 'Rollback automatico incompleto (%s falha(s)); use os backups preservados.\n' \
      "$rollback_failures" >&2
  fi
}

connectivity_check() {
  printf 'Validando conectividade TCP a partir dos CTs de testes...\n'

  pct exec 121 -- php -r \
    '$s=@fsockopen($argv[1],(int)$argv[2],$e,$m,5);if($s===false){exit(1);}fclose($s);' \
    "192.168.5.204" "3306" >/dev/null ||
    die "CT 121 nao alcanca o banco 192.168.5.204:3306"
  printf '[ok] CT 121 -> banco 192.168.5.204:3306\n'

  pct exec 121 -- php -r \
    '$s=@fsockopen($argv[1],(int)$argv[2],$e,$m,5);if($s===false){exit(1);}fclose($s);' \
    "192.168.5.203" "8095" >/dev/null ||
    die "CT 121 nao alcanca o processor 192.168.5.203:8095"
  printf '[ok] CT 121 -> processor 192.168.5.203:8095\n'

  pct exec 122 -- python3 -c \
    'import socket,sys;s=socket.create_connection((sys.argv[1],int(sys.argv[2])),5);s.close()' \
    "192.168.5.202" "80" >/dev/null ||
    die "CT 122 nao alcanca o backend 192.168.5.202:80"
  printf '[ok] CT 122 -> backend 192.168.5.202:80\n'

  pct exec 122 -- python3 -c '
import json
import sys
import urllib.request

values = {}
with open(sys.argv[1], encoding="utf-8") as stream:
    for raw_line in stream:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("\"").strip("'"'"'")

token = values.get("SANTILAC_API_TOKEN", "").strip()
sync_url = values.get("SANTILAC_SYNC_STATE_URL", "").strip()
api_url = values.get("SANTILAC_API_URL", "").strip()
if not sync_url and api_url.endswith("/coletas"):
    sync_url = api_url[:-len("/coletas")] + "/sync-state"
if not token or not sync_url:
    raise SystemExit(2)

request = urllib.request.Request(
    sync_url,
    headers={"Accept": "application/json", "Authorization": "Bearer " + token},
)
with urllib.request.urlopen(request, timeout=10) as response:
    payload = json.loads(response.read().decode("utf-8"))
    if not 200 <= response.status < 300 or payload.get("success") is not True:
        raise SystemExit(3)
' "/etc/santilac-pasteurizador/processor.env" >/dev/null 2>&1 ||
    die "CT 122 nao autenticou no sync-state do backend; confira SANTILAC_API_TOKEN/SANTILAC_API_KEY"
  printf '[ok] CT 122 -> sync-state autenticado (segredo oculto)\n'

  pct exec 122 -- python3 -c \
    'import socket,sys;s=socket.create_connection((sys.argv[1],int(sys.argv[2])),5);s.close()' \
    "192.168.5.101" "502" >/dev/null ||
    die "CT 122 nao alcanca o FieldLogger em 192.168.5.101:502"
  printf '[ok] CT 122 -> FieldLogger 192.168.5.101:502\n'
}

declare -A ORIGINAL_NET0=()
declare -A PROPOSED_NET0=()
declare -A ORIGINAL_SIGNATURE=()
declare -A STATE=()
declare -a ORIGINAL_ENV_INSPECTION=()
declare -a ENV_STATE=()
network_needs_migration="0"
env_needs_migration="0"

printf 'Rede esperada dos testes: 192.168.5.0/%s, gateway %s\n' \
  "$PREFIX_LENGTH" "$TARGET_GATEWAY"

# Preflight global: nenhum CT e alterado antes que todos estejam em um estado conhecido.
for ct in "${TEST_CTS[@]}"; do
  current_net0="$(read_net0 "$ct")"
  current_ip="$(option_value "$ct" "$current_net0" "ip")"
  current_gateway="$(option_value "$ct" "$current_net0" "gw")"
  target_ip="${TARGET_IPS[$ct]}"
  legacy_ip="${LEGACY_IPS[$ct]}"

  ORIGINAL_NET0["$ct"]="$current_net0"
  ORIGINAL_SIGNATURE["$ct"]="$(preserved_options_signature "$current_net0")"

  if [[ "$current_ip" == "$target_ip" && "$current_gateway" == "$TARGET_GATEWAY" ]]; then
    STATE["$ct"]="ready"
    PROPOSED_NET0["$ct"]="$current_net0"
    printf '[ok] CT %s ja usa ip=%s, gw=%s\n' "$ct" "$target_ip" "$TARGET_GATEWAY"
    continue
  fi

  if [[ "$current_ip" == "$legacy_ip" && "$current_gateway" == "$LEGACY_GATEWAY" ]]; then
    STATE["$ct"]="migrate"
    network_needs_migration="1"
    PROPOSED_NET0["$ct"]="$(replace_ip_and_gateway "$ct" "$current_net0" "$target_ip")"
    printf '[pendente] CT %s: ip=%s,gw=%s -> ip=%s,gw=%s\n' \
      "$ct" "$legacy_ip" "$LEGACY_GATEWAY" "$target_ip" "$TARGET_GATEWAY"
    continue
  fi

  die "CT ${ct}: estado recusado (ip=${current_ip}, gw=${current_gateway}); esperado legado ip=${legacy_ip},gw=${LEGACY_GATEWAY} ou final ip=${target_ip},gw=${TARGET_GATEWAY}"
done

# Os arquivos .env sao preservados pelo deploy; eles fazem parte do mesmo preflight.
for index in "${!ENV_CTS[@]}"; do
  ct="${ENV_CTS[$index]}"
  env_path="${ENV_PATHS[$index]}"
  profile="${ENV_PROFILES[$index]}"
  required_file="${ENV_REQUIRED_FILES[$index]}"

  if ! inspection="$(
    run_env_helper \
      "inspect" \
      "$ct" \
      "$env_path" \
      "$profile" \
      "$required_file"
  )"; then
    die "CT ${ct}: falha ao validar hosts conhecidos em ${env_path}"
  fi

  if [[ "$inspection" == *$'\n'* ]]; then
    die "CT ${ct}: resposta inesperada ao validar ${env_path}"
  fi
  env_state="${inspection%%|*}"
  case "$env_state" in
    ready)
      printf '[ok] CT %s: hosts conhecidos corretos em %s\n' "$ct" "$env_path"
      ;;
    legacy)
      env_needs_migration="1"
      printf '[pendente] CT %s: hosts conhecidos precisam migrar em %s (segredos ocultos)\n' \
        "$ct" "$env_path"
      ;;
    skipped)
      printf '[ignorado] CT %s: env opcional ausente em %s\n' "$ct" "$env_path"
      ;;
    *)
      die "CT ${ct}: estado de env inesperado em ${env_path}"
      ;;
  esac

  ORIGINAL_ENV_INSPECTION[$index]="$inspection"
  ENV_STATE[$index]="$env_state"
done

needs_migration="0"
if [[ "$network_needs_migration" == "1" || "$env_needs_migration" == "1" ]]; then
  needs_migration="1"
fi

if [[ "$MODE" == "check" ]]; then
  if [[ "$needs_migration" == "1" ]]; then
    die "infraestrutura de testes ainda nao foi migrada; rode o dry-run e depois --apply no Proxmox"
  fi
  if [[ "$CHECK_CONNECTIVITY" == "1" ]]; then
    connectivity_check
  fi
  printf 'Preflight da infraestrutura de testes: OK.\n'
  exit 0
fi

if [[ "$MODE" == "dry-run" ]]; then
  if [[ "$needs_migration" == "0" ]]; then
    printf 'Dry-run: nenhuma alteracao necessaria.\n'
    exit 0
  fi

  printf '\nDry-run: nenhuma alteracao foi executada.\n'
  if [[ "$network_needs_migration" == "1" ]]; then
    printf 'Comandos de rede propostos:\n'
    for ct in "${TEST_CTS[@]}"; do
      if [[ "${STATE[$ct]}" == "migrate" ]]; then
        printf '  pct set %q -net0 %q\n' "$ct" "${PROPOSED_NET0[$ct]}"
      fi
    done
  fi
  if [[ "$env_needs_migration" == "1" ]]; then
    printf 'Env(s) propostos para atualizacao atomica, com backup e segredos ocultos:\n'
    for index in "${!ENV_CTS[@]}"; do
      if [[ "${ENV_STATE[$index]}" == "legacy" ]]; then
        printf '  CT %s: %s\n' "${ENV_CTS[$index]}" "${ENV_PATHS[$index]}"
      fi
    done
  fi
  printf '\nRevise e execute novamente com --apply para gravar.\n'
  exit 0
fi

[[ "$MODE" == "apply" ]] || die "modo interno invalido: ${MODE}"
if [[ "$needs_migration" == "0" ]]; then
  printf 'Apply: nenhuma alteracao necessaria; todos os CTs ja estao corretos.\n'
  exit 0
fi

# Evita uma corrida entre o primeiro preflight e a primeira escrita.
for ct in "${TEST_CTS[@]}"; do
  live_net0="$(read_net0 "$ct")"
  if [[ "$live_net0" != "${ORIGINAL_NET0[$ct]}" ]]; then
    die "CT ${ct}: net0 mudou durante o preflight; nenhuma alteracao foi aplicada"
  fi
done

# Detecta mudancas concorrentes nos envs antes de qualquer escrita.
for index in "${!ENV_CTS[@]}"; do
  if ! live_inspection="$(
    run_env_helper \
      "inspect" \
      "${ENV_CTS[$index]}" \
      "${ENV_PATHS[$index]}" \
      "${ENV_PROFILES[$index]}" \
      "${ENV_REQUIRED_FILES[$index]}"
  )"; then
    die "CT ${ENV_CTS[$index]}: nao foi possivel reler ${ENV_PATHS[$index]}"
  fi
  if [[ "$live_inspection" != "${ORIGINAL_ENV_INSPECTION[$index]}" ]]; then
    die "CT ${ENV_CTS[$index]}: env mudou durante o preflight; nenhuma alteracao foi aplicada"
  fi
done

umask 077
migration_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
backup_file=""
if [[ "$network_needs_migration" == "1" ]]; then
  mkdir -p "$BACKUP_DIR"
  backup_file="${BACKUP_DIR%/}/test-network-before-${migration_id}.tsv"
  [[ ! -e "$backup_file" ]] || die "arquivo de backup ja existe: ${backup_file}"
  {
    printf '# CT<TAB>net0 original; gerado antes da migracao para %s\n' "$TARGET_GATEWAY"
    for ct in "${TEST_CTS[@]}"; do
      printf '%s\t%s\n' "$ct" "${ORIGINAL_NET0[$ct]}"
    done
  } >"$backup_file"
  printf 'Backup pre-migracao da rede: %s\n' "$backup_file"
fi

ROLLBACK_ARMED="1"
trap 'rollback_apply "$?"' EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# Os envs sao atualizados primeiro. Servicos nao sao reiniciados pelo script, portanto
# os novos valores so passam a valer junto da ativacao operacional programada.
for index in "${!ENV_CTS[@]}"; do
  if [[ "${ENV_STATE[$index]}" != "legacy" ]]; then
    continue
  fi

  ct="${ENV_CTS[$index]}"
  env_path="${ENV_PATHS[$index]}"
  printf '[apply] CT %s: atualizando hosts conhecidos em %s (segredos ocultos)\n' \
    "$ct" "$env_path"
  APPLY_ENV_ATTEMPTS+=("$index")
  if ! apply_result="$(
    run_env_helper \
      "apply" \
      "$ct" \
      "$env_path" \
      "${ENV_PROFILES[$index]}" \
      "${ENV_REQUIRED_FILES[$index]}" \
      "$migration_id"
  )"; then
    die "CT ${ct}: falha ao atualizar ${env_path}; consulte o backup adjacente ao env"
  fi
  [[ "${apply_result%%|*}" == "updated" ]] ||
    die "CT ${ct}: resultado inesperado ao atualizar ${env_path}"

  if ! verified_env="$(
    run_env_helper \
      "inspect" \
      "$ct" \
      "$env_path" \
      "${ENV_PROFILES[$index]}" \
      "${ENV_REQUIRED_FILES[$index]}"
  )"; then
    die "CT ${ct}: falha ao verificar ${env_path} depois da atualizacao"
  fi
  [[ "${verified_env%%|*}" == "ready" ]] ||
    die "CT ${ct}: hosts conhecidos nao ficaram no estado final em ${env_path}"
  printf '[ok] CT %s: env atualizado, verificado e com backup adjacente.\n' "$ct"
done

# Os envs podem levar alguns segundos; rele a rede imediatamente antes da etapa
# de pct set para nao sobrescrever uma mudanca concorrente ocorrida nesse intervalo.
for ct in "${TEST_CTS[@]}"; do
  live_net0="$(read_net0 "$ct")"
  if [[ "$live_net0" != "${ORIGINAL_NET0[$ct]}" ]]; then
    die "CT ${ct}: net0 mudou antes da gravacao; a rede nao foi alterada, revise os backups dos envs"
  fi
done

for ct in "${TEST_CTS[@]}"; do
  if [[ "${STATE[$ct]}" != "migrate" ]]; then
    continue
  fi

  APPLY_NETWORK_ATTEMPTS+=("$ct")
  live_net0="$(read_net0 "$ct")"
  if [[ "$live_net0" != "${ORIGINAL_NET0[$ct]}" ]]; then
    die "CT ${ct}: net0 mudou imediatamente antes do pct set; consulte os backups"
  fi
  printf '[apply] CT %s\n' "$ct"
  pct set "$ct" -net0 "${PROPOSED_NET0[$ct]}"

  verified_net0="$(read_net0 "$ct")"
  verified_ip="$(option_value "$ct" "$verified_net0" "ip")"
  verified_gateway="$(option_value "$ct" "$verified_net0" "gw")"
  verified_signature="$(preserved_options_signature "$verified_net0")"

  [[ "$verified_ip" == "${TARGET_IPS[$ct]}" ]] ||
    die "CT ${ct}: verificacao falhou para ip=${verified_ip}; consulte ${backup_file:-os backups dos envs}"
  [[ "$verified_gateway" == "$TARGET_GATEWAY" ]] ||
    die "CT ${ct}: verificacao falhou para gw=${verified_gateway}; consulte ${backup_file:-os backups dos envs}"
  [[ "$verified_signature" == "${ORIGINAL_SIGNATURE[$ct]}" ]] ||
    die "CT ${ct}: uma opcao alem de ip/gw mudou; consulte ${backup_file:-os backups dos envs}"

  printf '[ok] CT %s gravado e verificado.\n' "$ct"
done

ROLLBACK_ARMED="0"
trap - EXIT HUP INT TERM
printf 'Migracao de configuracao concluida. Nenhum container foi reiniciado.\n'
printf 'Execute --check --connectivity antes do deploy e programe qualquer restart separadamente.\n'
