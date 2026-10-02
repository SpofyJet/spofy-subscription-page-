#!/usr/bin/env bash
# Swap the running subscription page to spofy-subpage:<tag>. Run on significant-fuchsia.
# The image that is running now gets tagged spofy-subpage:prev (rollback target).
# Usage: deploy/spofy/deploy.sh <tag>
set -euo pipefail
TAG=${1:?usage: deploy.sh <tag>}
DIR=/opt/remnawave/subscription
NAME=remnawave-subscription-page
NEW="spofy-subpage:$TAG"

docker image inspect "$NEW" >/dev/null
grep -q '^SPOFY_RENEW_URL=' "$DIR/.env" || echo "WARN: SPOFY_* vars missing in $DIR/.env — CTAs will be hidden" >&2

NEW_ID=$(docker image inspect -f '{{.Id}}' "$NEW")
CUR_ID=$(docker inspect -f '{{.Image}}' "$NAME")
if [ "$CUR_ID" = "$NEW_ID" ]; then
    echo "$NEW is already running"; exit 0
fi
docker tag "$CUR_ID" spofy-subpage:prev
echo "tagged running image $CUR_ID as spofy-subpage:prev"

STAMP=$(date +%Y%m%d_%H%M%S)
cp -p "$DIR/docker-compose.yml" "$DIR/docker-compose.yml.bak-$STAMP"
sed -i -E "s#^([[:space:]]*image:).*#\1 $NEW#" "$DIR/docker-compose.yml"
grep -n 'image:' "$DIR/docker-compose.yml"

(cd "$DIR" && docker compose up -d)
"$(dirname "$0")/wait-healthy.sh" "$NAME"
