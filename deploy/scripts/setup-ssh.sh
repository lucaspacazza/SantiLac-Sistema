#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?DEPLOY_HOST nao definido}"
: "${DEPLOY_USER:?DEPLOY_USER nao definido}"
: "${DEPLOY_SSH_KEY:?DEPLOY_SSH_KEY nao definido}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/santilac_deploy_key}"

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

printf '%s\n' "$DEPLOY_SSH_KEY" > "$SSH_KEY_PATH"
chmod 600 "$SSH_KEY_PATH"

ssh-keyscan -p "$DEPLOY_PORT" "$DEPLOY_HOST" >> "$HOME/.ssh/known_hosts" 2>/dev/null

cat > "$HOME/.ssh/config" <<EOF
Host santilac-deploy
  HostName $DEPLOY_HOST
  Port $DEPLOY_PORT
  User $DEPLOY_USER
  IdentityFile $SSH_KEY_PATH
  IdentitiesOnly yes
  StrictHostKeyChecking yes
EOF

chmod 600 "$HOME/.ssh/config"
