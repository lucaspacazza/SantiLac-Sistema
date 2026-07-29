#!/usr/bin/env bash
set -euo pipefail

readonly TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPOSITORY_ROOT="$(cd "$TEST_DIR/../.." && pwd)"
readonly MIGRATOR="$REPOSITORY_ROOT/deploy/scripts/migrate-test-network.sh"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

fake_bin="$work_dir/bin"
state_dir="$work_dir/state"
backup_dir="$work_dir/backups"
log_file="$work_dir/pct-set.log"
mkdir -p "$fake_bin" "$state_dir"
: >"$log_file"

cat >"$fake_bin/pct" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  config)
    cat "$FAKE_PCT_STATE_DIR/${2}.conf"
    ;;
  set)
    ct="${2:-}"
    [[ "${3:-}" == "-net0" ]]
    net0="${4:-}"
    printf '%s\t%s\n' "$ct" "$net0" >>"$FAKE_PCT_LOG"
    tmp="$FAKE_PCT_STATE_DIR/${ct}.tmp"
    awk -v replacement="$net0" '
      /^net0:[[:space:]]*/ {
        print "net0: " replacement
        next
      }
      { print }
    ' "$FAKE_PCT_STATE_DIR/${ct}.conf" >"$tmp"
    mv "$tmp" "$FAKE_PCT_STATE_DIR/${ct}.conf"
    if [[ -n "${FAKE_PCT_SET_FAIL_CT_ONCE:-}" &&
      "$ct" == "$FAKE_PCT_SET_FAIL_CT_ONCE" &&
      "$net0" == *"ip=192.168.5."* &&
      ! -e "$FAKE_PCT_STATE_DIR/pct-set-failure-${ct}" ]]; then
      : >"$FAKE_PCT_STATE_DIR/pct-set-failure-${ct}"
      exit 42
    fi
    ;;
  exec)
    ct="${2:-}"
    shift 2
    [[ "${1:-}" == "--" ]]
    shift
    if [[ "${1:-}" == "php" || "${1:-}" == "python3" ]]; then
      if [[ -n "${FAKE_CONNECTIVITY_FAIL:-}" && "$*" == *"$FAKE_CONNECTIVITY_FAIL"* ]]; then
        exit 1
      fi
      exit 0
    fi
    if [[ -n "${FAKE_ENV_APPLY_FAIL_MATCH:-}" &&
      "$*" == *"ENV_MODE=apply"* &&
      "$*" == *"$FAKE_ENV_APPLY_FAIL_MATCH"* ]]; then
      set +e
      SANTILAC_MIGRATION_TEST_ROOT="$FAKE_PCT_STATE_DIR/root-${ct}" "$@"
      status="$?"
      set -e
      ((status == 0)) || exit "$status"
      exit 43
    fi
    SANTILAC_MIGRATION_TEST_ROOT="$FAKE_PCT_STATE_DIR/root-${ct}" "$@"
    ;;
  *)
    printf 'fake pct: comando inesperado: %s\n' "${1:-}" >&2
    exit 2
    ;;
esac
EOF
chmod +x "$fake_bin/pct"

export PATH="$fake_bin:$PATH"
export FAKE_PCT_STATE_DIR="$state_dir"
export FAKE_PCT_LOG="$log_file"

run_migrator() {
  bash "$MIGRATOR" "$@"
}

fail() {
  printf 'FALHOU: %s\n' "$*" >&2
  exit 1
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  [[ "$haystack" == *"$needle"* ]] ||
    fail "saida nao contem: ${needle}"
}

assert_log_lines() {
  local expected="$1"
  local actual
  actual="$(wc -l <"$log_file" | tr -d '[:space:]')"
  [[ "$actual" == "$expected" ]] ||
    fail "esperadas ${expected} escritas pct; encontradas ${actual}"
}

assert_legacy_state() {
  local ct
  for ct in 120 121 122; do
    grep -Fq "gw=192.168.0.1" "$state_dir/${ct}.conf" ||
      fail "CT ${ct} nao voltou ao gateway legado"
    grep -Fq "ip=192.168.0.${ct}/24" "$state_dir/${ct}.conf" ||
      fail "CT ${ct} nao voltou ao IP legado"
  done

  grep -Fq 'DB_HOST=192.168.0.204' \
    "$state_dir/root-121/var/www/santilac-backend/.env" ||
    fail "env principal do backend nao voltou ao DB_HOST legado"
  grep -Fq 'PASTEURIZADOR_PROCESSOR_URL=http://192.168.0.203:8095' \
    "$state_dir/root-121/var/www/santilac-pwa-producao-backend/.env" ||
    fail "env do PWA nao voltou a URL legada"
  grep -Fq 'SANTILAC_API_URL=http://192.168.0.202/api/pasteurizador/coletas' \
    "$state_dir/root-122/etc/santilac-pasteurizador/processor.env" ||
    fail "env principal do processor nao voltou a API legada"
  grep -Fq 'FIELDLOGGER_HOST=192.168.0.101' \
    "$state_dir/root-122/var/www/processor/.env" ||
    fail "env opcional do processor nao voltou ao FieldLogger legado"
}

write_state() {
  local network="$1"
  local gateway="$2"
  local ct
  for ct in 120 121 122; do
    cat >"$state_dir/${ct}.conf" <<EOF
arch: amd64
hostname: santilac-test-${ct}
net0: name=eth0,bridge=vmbr-test,firewall=1,gw=${gateway},hwaddr=DE:AD:BE:EF:00:${ct: -2},ip=192.168.${network}.${ct}/24,mtu=1400,rate=50,tag=7,type=veth
onboot: 1
EOF
  done
}

write_envs() {
  local network="$1"
  local backend_root="$state_dir/root-121"
  local processor_root="$state_dir/root-122"
  local backend_url="http://192.168.${network}.203:8095"
  local api_url="http://192.168.${network}.202/api/pasteurizador/coletas"
  local sync_url="http://192.168.${network}.202/api/pasteurizador/sync-state"

  mkdir -p \
    "$backend_root/var/www/santilac-backend" \
    "$backend_root/var/www/santilac-pwa-producao-backend" \
    "$processor_root/etc/santilac-pasteurizador" \
    "$processor_root/var/www/processor"

  cat >"$backend_root/var/www/santilac-backend/.env" <<EOF
APP_KEY=super-secret-backend
DB_HOST=192.168.${network}.204
DB_PASSWORD=another-secret
PASTEURIZADOR_PROCESSOR_URL=${backend_url}
EOF
  cp \
    "$backend_root/var/www/santilac-backend/.env" \
    "$backend_root/var/www/santilac-pwa-producao-backend/.env"

  cat >"$processor_root/etc/santilac-pasteurizador/processor.env" <<EOF
SANTILAC_API_TOKEN=super-secret-processor
SANTILAC_API_URL=${api_url}
SANTILAC_SYNC_STATE_URL=${sync_url}
FIELDLOGGER_HOST=192.168.${network}.101
EOF
  cp \
    "$processor_root/etc/santilac-pasteurizador/processor.env" \
    "$processor_root/var/www/processor/.env"
}

write_legacy_state() {
  write_state "0" "192.168.0.1"
  write_envs "0"
}

write_target_state() {
  write_state "5" "192.168.5.1"
  write_envs "5"
}

printf 'Contrato: dry-run nao escreve e mostra o plano...\n'
write_legacy_state
: >"$log_file"
output="$(run_migrator)"
assert_contains "$output" "Dry-run"
assert_contains "$output" "192.168.5.120/24"
assert_contains "$output" "192.168.5.122/24"
if [[ "$output" == *"super-secret"* ]]; then
  fail "dry-run revelou um segredo"
fi
assert_log_lines "0"
grep -Fq 'ip=192.168.0.120/24' "$state_dir/120.conf" ||
  fail "dry-run alterou o estado"

printf 'Contrato: check recusa a rede legada sem escrever...\n'
: >"$log_file"
if output="$(run_migrator --check 2>&1)"; then
  fail "--check deveria recusar a rede legada"
fi
assert_contains "$output" "ainda nao foi migrada"
assert_log_lines "0"

printf 'Contrato: preflight global recusa estado desconhecido antes de qualquer escrita...\n'
write_legacy_state
sed -i 's/ip=192\.168\.0\.121\/24/ip=192.168.0.250\/24/' "$state_dir/121.conf"
: >"$log_file"
if output="$(run_migrator --apply --backup-dir "$backup_dir" 2>&1)"; then
  fail "--apply deveria recusar endereco inesperado"
fi
assert_contains "$output" "estado recusado"
assert_log_lines "0"

printf 'Contrato: valor de host desconhecido em env bloqueia toda a migracao...\n'
write_legacy_state
sed -i \
  's/DB_HOST=192\.168\.0\.204/DB_HOST=192.168.9.204/' \
  "$state_dir/root-121/var/www/santilac-backend/.env"
: >"$log_file"
if output="$(run_migrator --apply --backup-dir "$backup_dir" 2>&1)"; then
  fail "--apply deveria recusar DB_HOST desconhecido"
fi
assert_contains "$output" "falha ao validar hosts conhecidos"
if [[ "$output" == *"super-secret"* ]]; then
  fail "erro de env revelou um segredo"
fi
assert_log_lines "0"

printf 'Contrato: FIELDLOGGER_HOST fora dos pares legado/final e recusado...\n'
write_legacy_state
sed -i \
  's/FIELDLOGGER_HOST=192\.168\.0\.101/FIELDLOGGER_HOST=192.168.9.101/' \
  "$state_dir/root-122/etc/santilac-pasteurizador/processor.env"
: >"$log_file"
if output="$(run_migrator --apply --backup-dir "$backup_dir" 2>&1)"; then
  fail "--apply deveria recusar FIELDLOGGER_HOST fora de .0.101/.5.101"
fi
assert_contains "$output" "falha ao validar hosts conhecidos"
assert_log_lines "0"

printf 'Contrato: falha intermediaria em env restaura todos os envs ja alterados...\n'
write_legacy_state
: >"$log_file"
export FAKE_ENV_APPLY_FAIL_MATCH="/var/www/santilac-pwa-producao-backend/.env"
if output="$(run_migrator --apply --backup-dir "$backup_dir" 2>&1)"; then
  fail "--apply deveria propagar a falha intermediaria do env"
fi
unset FAKE_ENV_APPLY_FAIL_MATCH
assert_contains "$output" "Rollback automatico concluido"
assert_contains "$output" "backups foram mantidos"
assert_log_lines "0"
assert_legacy_state
find "$state_dir" -type f -name '*.santilac-network-backup-*' |
  grep -q . ||
  fail "rollback de env removeu os backups de recuperacao"

printf 'Contrato: falha intermediaria em pct set restaura net0 e envs...\n'
write_legacy_state
rm -f "$state_dir"/pct-set-failure-*
: >"$log_file"
export FAKE_PCT_SET_FAIL_CT_ONCE="121"
if output="$(run_migrator --apply --backup-dir "$backup_dir" 2>&1)"; then
  fail "--apply deveria propagar a falha intermediaria de pct set"
fi
unset FAKE_PCT_SET_FAIL_CT_ONCE
assert_contains "$output" "Rollback automatico concluido"
assert_contains "$output" "CT 120: net0 original restaurado"
assert_contains "$output" "CT 121: net0 original restaurado"
assert_log_lines "4"
assert_legacy_state
find "$state_dir" -type f -name '*.santilac-network-backup-*' |
  grep -q . ||
  fail "rollback da rede removeu os backups de recuperacao"

printf 'Contrato: apply migra net0/envs com backups e preserva o restante...\n'
write_legacy_state
: >"$log_file"
output="$(run_migrator --apply --backup-dir "$backup_dir")"
assert_contains "$output" "Nenhum container foi reiniciado"
assert_log_lines "3"
grep -Fq \
  'net0: name=eth0,bridge=vmbr-test,firewall=1,gw=192.168.5.1,hwaddr=DE:AD:BE:EF:00:20,ip=192.168.5.120/24,mtu=1400,rate=50,tag=7,type=veth' \
  "$state_dir/120.conf" ||
  fail "CT 120 perdeu ou alterou opcoes preservadas"
grep -Fq $'120\tname=eth0,bridge=vmbr-test,firewall=1,gw=192.168.0.1' \
  "$(find "$backup_dir" -type f -name '*.tsv' | sort | tail -n 1)" ||
  fail "backup nao contem net0 original"
grep -Fq 'DB_HOST=192.168.5.204' \
  "$state_dir/root-121/var/www/santilac-backend/.env" ||
  fail "DB_HOST vivo nao foi migrado"
grep -Fq 'PASTEURIZADOR_PROCESSOR_URL=http://192.168.5.203:8095' \
  "$state_dir/root-121/var/www/santilac-pwa-producao-backend/.env" ||
  fail "URL do processor no env do PWA nao foi migrada"
grep -Fq 'SANTILAC_API_URL=http://192.168.5.202/api/pasteurizador/coletas' \
  "$state_dir/root-122/etc/santilac-pasteurizador/processor.env" ||
  fail "SANTILAC_API_URL viva nao foi migrada"
grep -Fq 'SANTILAC_SYNC_STATE_URL=http://192.168.5.202/api/pasteurizador/sync-state' \
  "$state_dir/root-122/var/www/processor/.env" ||
  fail "SANTILAC_SYNC_STATE_URL viva nao foi migrada"
grep -Fq 'FIELDLOGGER_HOST=192.168.5.101' \
  "$state_dir/root-122/etc/santilac-pasteurizador/processor.env" ||
  fail "FIELDLOGGER_HOST nao foi migrado para a nova bridge"
grep -Fq 'FIELDLOGGER_HOST=192.168.5.101' \
  "$state_dir/root-122/var/www/processor/.env" ||
  fail "FIELDLOGGER_HOST do env opcional nao foi migrado"
grep -Fq 'APP_KEY=super-secret-backend' \
  "$state_dir/root-121/var/www/santilac-backend/.env" ||
  fail "segredo alheio foi alterado"
find "$state_dir" -type f -name '*.santilac-network-backup-*' |
  grep -q . ||
  fail "backups adjacentes dos envs nao foram criados"
if [[ "$output" == *"super-secret"* ]]; then
  fail "apply revelou um segredo"
fi

printf 'Contrato: check aceita o estado final...\n'
output="$(run_migrator --check --connectivity)"
assert_contains "$output" "Preflight da infraestrutura de testes: OK"
assert_contains "$output" "FieldLogger 192.168.5.101:502"
assert_contains "$output" "sync-state autenticado"

printf 'Contrato: falha de conectividade bloqueia o preflight...\n'
export FAKE_CONNECTIVITY_FAIL="192.168.5.101"
if output="$(run_migrator --check --connectivity 2>&1)"; then
  fail "--check --connectivity deveria propagar falha do FieldLogger"
fi
unset FAKE_CONNECTIVITY_FAIL
assert_contains "$output" "nao alcanca o FieldLogger em"

printf 'Contrato: apply e idempotente no estado final...\n'
: >"$log_file"
backups_before="$(
  find "$state_dir" -type f -name '*.santilac-network-backup-*' | wc -l |
    tr -d '[:space:]'
)"
output="$(run_migrator --apply --backup-dir "$backup_dir")"
assert_contains "$output" "nenhuma alteracao necessaria"
assert_log_lines "0"
backups_after="$(
  find "$state_dir" -type f -name '*.santilac-network-backup-*' | wc -l |
    tr -d '[:space:]'
)"
[[ "$backups_after" == "$backups_before" ]] ||
  fail "apply idempotente criou backups desnecessarios"

printf 'Contrato: inventario antigo .201 do CT 120 e recusado...\n'
write_target_state
sed -i 's/ip=192\.168\.5\.120\/24/ip=192.168.5.201\/24/' "$state_dir/120.conf"
: >"$log_file"
if output="$(run_migrator --check 2>&1)"; then
  fail "--check deveria recusar o antigo IP .201 do CT 120"
fi
assert_contains "$output" "esperado legado ip=192.168.0.120/24"
assert_contains "$output" "final ip=192.168.5.120/24"
assert_log_lines "0"

printf 'Contrato: pares mistos de ip/gateway sao recusados...\n'
write_target_state
sed -i 's/gw=192\.168\.5\.1/gw=192.168.0.1/' "$state_dir/122.conf"
: >"$log_file"
if output="$(run_migrator --dry-run 2>&1)"; then
  fail "par misto deveria ser recusado"
fi
assert_contains "$output" "estado recusado"
assert_log_lines "0"

printf 'Contratos da migracao da rede de testes: OK.\n'
