#!/usr/bin/env sh
set -eu

: "${DB_NAME:?DB_NAME nao definido}"
: "${DB_USER:?DB_USER nao definido}"
: "${DB_PASSWORD:?DB_PASSWORD nao definido}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
PACKAGE_PATH="${DATABASE_PACKAGE_PATH:-/tmp/santilac-database.tar.gz}"
WORK_DIR="${DATABASE_WORK_DIR:-/tmp/santilac-database-migrations}"
BACKUP_DIR="${DATABASE_BACKUP_DIR:-/var/backups/santilac-db}"

MYSQL="mysql -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASSWORD $DB_NAME"

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR" "$BACKUP_DIR"
tar -xzf "$PACKAGE_PATH" -C "$WORK_DIR"

$MYSQL -e "CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(255) NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL, executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"

BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_before_migrations_$(date +%Y%m%d%H%M%S).sql"
mysqldump -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" --single-transaction "$DB_NAME" > "$BACKUP_FILE"

MIGRATIONS_DIR="$WORK_DIR/database/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Nenhuma migration encontrada."
  rm -rf "$WORK_DIR" "$PACKAGE_PATH"
  exit 0
fi

find "$MIGRATIONS_DIR" -type f -name '*.sql' | sort | while IFS= read -r file; do
  rel="${file#$WORK_DIR/}"
  checksum="$(sha256sum "$file" | awk '{print $1}')"
  rel_sql="$(printf "%s" "$rel" | sed "s/'/''/g")"
  current="$($MYSQL -N -B -e "SELECT checksum FROM schema_migrations WHERE filename = '$rel_sql' LIMIT 1;" || true)"

  if [ -z "$current" ]; then
    echo "Executando migration: $rel"
    $MYSQL < "$file"
    $MYSQL -e "INSERT INTO schema_migrations (filename, checksum) VALUES ('$rel_sql', '$checksum');"
  elif [ "$current" != "$checksum" ]; then
    echo "Migration ja executada foi alterada: $rel" >&2
    echo "Crie um novo arquivo .sql em vez de editar migration ja aplicada." >&2
    exit 1
  else
    echo "Ignorando migration ja aplicada: $rel"
  fi
done

rm -rf "$WORK_DIR" "$PACKAGE_PATH"
echo "Backup salvo em: $BACKUP_FILE"
