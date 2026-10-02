#!/usr/bin/env bash
NAME=${1:-remnawave-subscription-page}
for _ in $(seq 1 45); do
    s=$(docker inspect -f '{{.State.Health.Status}}' "$NAME" 2>/dev/null || echo missing)
    [ "$s" = healthy ] && { echo "$NAME: healthy ($(docker inspect -f '{{.Config.Image}}' "$NAME"))"; exit 0; }
    sleep 2
done
echo "$NAME: NOT healthy ($s) — check: docker logs --tail 50 $NAME" >&2
exit 1
