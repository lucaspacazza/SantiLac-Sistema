#!/bin/sh
set -eu

error() {
  printf 'ENV_ERROR: %s\n' "$1" >&2
  exit 1
}

: "${ENV_FILE:?ENV_FILE ausente}"
: "${ENV_PROFILE:?ENV_PROFILE ausente}"
: "${ENV_REQUIRED_FILE:?ENV_REQUIRED_FILE ausente}"
: "${ENV_MODE:?ENV_MODE ausente}"

case "$ENV_PROFILE" in
  backend|processor|processor-optional)
    ;;
  *)
    error "perfil desconhecido"
    ;;
esac

case "$ENV_MODE" in
  inspect|apply|restore)
    ;;
  *)
    error "modo desconhecido"
    ;;
esac

case "$ENV_REQUIRED_FILE" in
  0|1)
    ;;
  *)
    error "marcador de arquivo obrigatorio invalido"
    ;;
esac

env_file="${SANTILAC_MIGRATION_TEST_ROOT:-}${ENV_FILE}"
if [ ! -f "$env_file" ]; then
  if [ "$ENV_REQUIRED_FILE" = "1" ]; then
    error "arquivo obrigatorio ausente: ${ENV_FILE}"
  fi
  printf 'skipped|absent\n'
  exit 0
fi

read_value() {
  wanted_key="$1"
  awk -v wanted="$wanted_key" '
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      return value
    }
    /^[[:space:]]*#/ { next }
    {
      separator = index($0, "=")
      if (separator == 0) {
        next
      }
      key = trim(substr($0, 1, separator - 1))
      if (key != wanted) {
        next
      }
      count += 1
      value = trim(substr($0, separator + 1))
      single_quote = sprintf("%c", 39)
      first = substr(value, 1, 1)
      last = substr(value, length(value), 1)
      if (length(value) >= 2 && ((first == "\"" && last == "\"") || (first == single_quote && last == single_quote))) {
        value = substr(value, 2, length(value) - 2)
      }
      print value
    }
    END {
      if (count == 0) {
        exit 3
      }
      if (count > 1) {
        exit 4
      }
    }
  ' "$env_file"
}

classify_key() {
  key="$1"
  legacy="$2"
  target="$3"
  required="$4"

  if value="$(read_value "$key")"; then
    :
  else
    result="$?"
    if [ "$result" = "3" ] && [ "$required" = "0" ]; then
      printf 'missing'
      return 0
    fi
    if [ "$result" = "3" ]; then
      error "chave obrigatoria ausente: ${key}"
    fi
    if [ "$result" = "4" ]; then
      error "chave duplicada: ${key}"
    fi
    error "nao foi possivel ler a chave: ${key}"
  fi

  if [ "$value" = "$target" ]; then
    printf 'ready'
    return 0
  fi
  if [ "$value" = "$legacy" ]; then
    printf 'legacy'
    return 0
  fi
  error "chave com valor nao reconhecido: ${key}"
}

state="ready"
case "$ENV_PROFILE" in
  backend)
    db_state="$(
      classify_key \
        "DB_HOST" \
        "192.168.0.204" \
        "192.168.5.204" \
        "1"
    )"
    processor_state="$(
      classify_key \
        "PASTEURIZADOR_PROCESSOR_URL" \
        "http://192.168.0.203:8095" \
        "http://192.168.5.203:8095" \
        "1"
    )"
    if [ "$db_state" = "legacy" ] || [ "$processor_state" = "legacy" ]; then
      state="legacy"
    fi
    ;;
  processor|processor-optional)
    api_required="1"
    if [ "$ENV_PROFILE" = "processor-optional" ]; then
      api_required="0"
    fi
    api_state="$(
      classify_key \
        "SANTILAC_API_URL" \
        "http://192.168.0.202/api/pasteurizador/coletas" \
        "http://192.168.5.202/api/pasteurizador/coletas" \
        "$api_required"
    )"
    sync_state="$(
      classify_key \
        "SANTILAC_SYNC_STATE_URL" \
        "http://192.168.0.202/api/pasteurizador/sync-state" \
        "http://192.168.5.202/api/pasteurizador/sync-state" \
        "0"
    )"
    fieldlogger_state="$(
      classify_key \
        "FIELDLOGGER_HOST" \
        "192.168.0.101" \
        "192.168.5.101" \
        "0"
    )"
    if [ "$api_state" = "legacy" ] || [ "$sync_state" = "legacy" ] || [ "$fieldlogger_state" = "legacy" ]; then
      state="legacy"
    fi
    ;;
esac

set -- $(cksum "$env_file")
fingerprint="$1:$2"

if [ "$ENV_MODE" = "inspect" ]; then
  printf '%s|%s\n' "$state" "$fingerprint"
  exit 0
fi

: "${BACKUP_SUFFIX:?BACKUP_SUFFIX ausente no modo apply/restore}"
case "$BACKUP_SUFFIX" in
  *[!A-Za-z0-9._-]*)
    error "sufixo de backup invalido"
    ;;
esac

backup_file="${env_file}.santilac-network-backup-${BACKUP_SUFFIX}"

render_migrated_env() {
  input_file="$1"
  output_file="$2"
  awk -v profile="$ENV_PROFILE" '
  function trim(value) {
    sub(/^[[:space:]]+/, "", value)
    sub(/[[:space:]]+$/, "", value)
    return value
  }
  {
    original = $0
    if ($0 ~ /^[[:space:]]*#/) {
      print original
      next
    }
    separator = index($0, "=")
    if (separator == 0) {
      print original
      next
    }
    key = trim(substr($0, 1, separator - 1))
    value = trim(substr($0, separator + 1))
    single_quote = sprintf("%c", 39)
    first = substr(value, 1, 1)
    last = substr(value, length(value), 1)
    if (length(value) >= 2 && ((first == "\"" && last == "\"") || (first == single_quote && last == single_quote))) {
      value = substr(value, 2, length(value) - 2)
    }

    if (profile == "backend" && key == "DB_HOST" && value == "192.168.0.204") {
      print "DB_HOST=192.168.5.204"
      next
    }
    if (profile == "backend" && key == "PASTEURIZADOR_PROCESSOR_URL" && value == "http://192.168.0.203:8095") {
      print "PASTEURIZADOR_PROCESSOR_URL=http://192.168.5.203:8095"
      next
    }
    if (profile ~ /^processor/ && key == "SANTILAC_API_URL" && value == "http://192.168.0.202/api/pasteurizador/coletas") {
      print "SANTILAC_API_URL=http://192.168.5.202/api/pasteurizador/coletas"
      next
    }
    if (profile ~ /^processor/ && key == "SANTILAC_SYNC_STATE_URL" && value == "http://192.168.0.202/api/pasteurizador/sync-state") {
      print "SANTILAC_SYNC_STATE_URL=http://192.168.5.202/api/pasteurizador/sync-state"
      next
    }
    if (profile ~ /^processor/ && key == "FIELDLOGGER_HOST" && value == "192.168.0.101") {
      print "FIELDLOGGER_HOST=192.168.5.101"
      next
    }
    print original
  }
' "$input_file" >"$output_file"
}

if [ "$ENV_MODE" = "restore" ]; then
  if [ ! -f "$backup_file" ]; then
    if [ "$state" = "legacy" ]; then
      printf 'unchanged|backup-absent\n'
      exit 0
    fi
    error "backup de rollback ausente"
  fi

  expected_file="$(mktemp "${env_file}.santilac-expected.XXXXXX")" ||
    error "nao foi possivel criar arquivo temporario de verificacao"
  restore_file="$(mktemp "${env_file}.santilac-restore.XXXXXX")" ||
    {
      rm -f "$expected_file"
      error "nao foi possivel criar arquivo temporario de rollback"
    }
  trap 'rm -f "$expected_file" "$restore_file"' EXIT HUP INT TERM

  render_migrated_env "$backup_file" "$expected_file"
  if cmp -s "$env_file" "$backup_file"; then
    printf 'unchanged|already-restored\n'
    exit 0
  fi
  if ! cmp -s "$env_file" "$expected_file"; then
    error "env mudou depois da migracao; rollback automatico recusado para preservar alteracoes concorrentes"
  fi

  cp -p "$backup_file" "$restore_file" ||
    error "nao foi possivel preparar o rollback do env"
  mv "$restore_file" "$env_file" ||
    error "nao foi possivel restaurar o env"
  rm -f "$expected_file"
  trap - EXIT HUP INT TERM
  printf 'restored|%s\n' "$ENV_FILE"
  exit 0
fi

if [ "$state" = "ready" ]; then
  printf 'ready|%s\n' "$fingerprint"
  exit 0
fi

[ ! -e "$backup_file" ] || error "backup de env ja existe para esta migracao"
cp -p "$env_file" "$backup_file"

tmp_file="$(mktemp "${env_file}.santilac-tmp.XXXXXX")" ||
  error "nao foi possivel criar arquivo temporario"
trap 'rm -f "$tmp_file"' EXIT HUP INT TERM

render_migrated_env "$env_file" "$tmp_file"

chmod --reference="$env_file" "$tmp_file" ||
  error "nao foi possivel preservar o modo do env"
chown --reference="$env_file" "$tmp_file" ||
  error "nao foi possivel preservar o owner do env"
mv "$tmp_file" "$env_file"
trap - EXIT HUP INT TERM

set -- $(cksum "$env_file")
printf 'updated|%s:%s\n' "$1" "$2"
