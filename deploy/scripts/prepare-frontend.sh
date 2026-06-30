#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PACKAGE_PATH="${FRONTEND_PACKAGE:-${RUNNER_TEMP:-/tmp}/santilac-frontend.tar.gz}"
STAGE_DIR="${RUNNER_TEMP:-/tmp}/santilac-frontend-stage"

cd "$ROOT_DIR/frontend"
npm ci
npm run build

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/assets/img"

cp -a dist/. "$STAGE_DIR/"

if [ -d public/assets/img ]; then
  cp -a public/assets/img/. "$STAGE_DIR/assets/img/"
fi

if [ -f public/sw.js ]; then
  cp public/sw.js "$STAGE_DIR/sw.js"
fi

if [ -f public/manifest.webmanifest ]; then
  cp public/manifest.webmanifest "$STAGE_DIR/manifest.webmanifest"
fi

tar -czf "$PACKAGE_PATH" -C "$STAGE_DIR" .
echo "FRONTEND_PACKAGE=$PACKAGE_PATH" >> "${GITHUB_ENV:-/dev/null}"
