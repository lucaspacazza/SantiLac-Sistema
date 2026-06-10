#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_CT:?DATABASE_CT nao definido}"
: "${DB_NAME:?DB_NAME nao definido}"
: "${DB_USER:?DB_USER nao definido}"
: "${DB_PASSWORD:?DB_PASSWORD nao definido}"

PACKAGE_PATH="${DATABASE_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-database.tar.gz}"
REMOTE_PACKAGE="/tmp/santilac-database-${GITHUB_SHA:-manual}.tar.gz"
REMOTE_SCRIPT="/tmp/santilac-run-migrations-${GITHUB_SHA:-manual}.sh"

scp "$PACKAGE_PATH" "santilac-deploy:$REMOTE_PACKAGE"
scp "deploy/scripts/remote-run-migrations.sh" "santilac-deploy:$REMOTE_SCRIPT"

ssh santilac-deploy "pct push '$DATABASE_CT' '$REMOTE_PACKAGE' '$REMOTE_PACKAGE'"
ssh santilac-deploy "pct push '$DATABASE_CT' '$REMOTE_SCRIPT' '$REMOTE_SCRIPT'"
ssh santilac-deploy "pct exec '$DATABASE_CT' -- sh -lc 'chmod +x \"$REMOTE_SCRIPT\" && DB_NAME=\"$DB_NAME\" DB_USER=\"$DB_USER\" DB_PASSWORD=\"$DB_PASSWORD\" DB_HOST=\"${DB_HOST:-127.0.0.1}\" DB_PORT=\"${DB_PORT:-3306}\" DATABASE_PACKAGE_PATH=\"$REMOTE_PACKAGE\" DATABASE_BACKUP_DIR=\"${DATABASE_BACKUP_DIR:-/var/backups/santilac-db}\" \"$REMOTE_SCRIPT\"'"
ssh santilac-deploy "rm -f '$REMOTE_PACKAGE' '$REMOTE_SCRIPT'"
