#!/usr/bin/env bash
# Build spofy-subpage:<git-sha> from a clean checkout of this repo. Needs only Docker.
# Usage: deploy/spofy/build.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain)" ]; then
    echo "working tree is dirty — commit first so the tag matches the code" >&2
    exit 1
fi
SHA=$(git rev-parse --short=12 HEAD)
NODE=node:24.18-trixie-slim

# frontend/dist is copied into the image (same as upstream's CI)
docker run --rm -e NPM_CONFIG_UPDATE_NOTIFIER=false -v "$PWD":/src -w /src/frontend "$NODE" \
    sh -c 'npm ci --no-audit --no-fund >/dev/null && npm run start:build'

docker build -t "spofy-subpage:$SHA" --label "org.opencontainers.image.revision=$SHA" \
    --label "org.opencontainers.image.source=https://github.com/SpofyJet/spofy-subscription-page" .
echo "built spofy-subpage:$SHA"
