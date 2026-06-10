#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_CT:?DATABASE_CT nao definido}"
: "${DB_NAME:?DB_NAME nao definido}"
: "${DB_USER:?DB_USER nao definido}"
: "${DB_PASSWORD:?DB_PASSWORD nao definido}"

PACKAGE_PATH="${DATABASE_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-database.tar.gz}"
REMOTE_PACKAGE="/tmp/santilac-database-${GITHUB_SHA:-manual}.tar.gz"
REMOTE_SCRIPT="/tmp/santilac-run-migrations-${GITHUB_SHA:-manual}.sh"

pct push "$DATABASE_CT" "$PACKAGE_PATH" "$REMOTE_PACKAGE"
pct push "$DATABASE_CT" "deploy/scripts/remote-run-migrations.sh" "$REMOTE_SCRIPT"
pct exec "$DATABASE_CT" -- sh -lc "chmod +x \"$REMOTE_SCRIPT\" && DB_NAME=\"$DB_NAME\" DB_USER=\"$DB_USER\" DB_PASSWORD=\"$DB_PASSWORD\" DB_HOST=\"${DB_HOST:-127.0.0.1}\" DB_PORT=\"${DB_PORT:-3306}\" DATABASE_PACKAGE_PATH=\"$REMOTE_PACKAGE\" DATABASE_BACKUP_DIR=\"${DATABASE_BACKUP_DIR:-/var/backups/santilac-db}\" \"$REMOTE_SCRIPT\""
