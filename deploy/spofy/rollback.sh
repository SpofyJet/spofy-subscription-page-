#!/usr/bin/env bash
# Run spofy-subpage:prev again (the image that was live before the last deploy).
set -euo pipefail
DIR=/opt/remnawave/subscription
NAME=remnawave-subscription-page
docker image inspect spofy-subpage:prev >/dev/null
cp -p "$DIR/docker-compose.yml" "$DIR/docker-compose.yml.bak-rollback-$(date +%Y%m%d_%H%M%S)"
sed -i -E "s#^([[:space:]]*image:).*#\1 spofy-subpage:prev#" "$DIR/docker-compose.yml"
(cd "$DIR" && docker compose up -d)
"$(dirname "$0")/wait-healthy.sh" "$NAME"
