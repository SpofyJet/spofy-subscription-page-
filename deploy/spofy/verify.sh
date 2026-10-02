#!/usr/bin/env bash
# Verify through the origin (Mitelis blocks curl on the public address).
# Usage: deploy/spofy/verify.sh <test shortUuid> [host:port, default 127.0.0.1:443]
set -uo pipefail
SU=${1:?usage: verify.sh <test shortUuid> [host:port]}
HP=${2:-127.0.0.1:443}
C=(curl -sk --connect-to "sub.spofyltd.ru:443:$HP" -m 20)
URL="https://sub.spofyltd.ru/$SU"
fail=0; ok() { echo "PASS  $*"; }; bad() { echo "FAIL  $*"; fail=1; }

# The panel's response rules only serve the web page to requests that accept text/html.
BROWSER=(-A 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
    -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')

# 1. web page: 200, Spofy shell, spofy payload present
html=$("${C[@]}" "${BROWSER[@]}" "$URL")
[ -n "$html" ] && ok "page served (${#html} bytes)" || bad "page empty"
grep -q 'spofy-favicon.svg' <<<"$html" && ok "Spofy frontend" || bad "not the Spofy frontend"
payload=$(grep -o 'data-panel="[^"]*"' <<<"$html" | cut -d'"' -f2 | base64 -d 2>/dev/null)
grep -q '"spofy":{' <<<"$payload" && ok "spofy payload: $(grep -o '"spofy":{[^}]*}' <<<"$payload")" || bad "no spofy payload"

# 2. compression still applied by Caddy
enc=$("${C[@]}" -o /dev/null -D - -H 'accept-encoding: zstd, gzip' "${BROWSER[@]}" "$URL" | tr -d '\r' | grep -i '^content-encoding' | cut -d' ' -f2)
[ -n "$enc" ] && ok "content-encoding: $enc" || bad "page not compressed"

# 3. raw subscription for client user agents
for ua in 'Happ/3.2.1/ios CFNetwork/1568.100.1 Darwin/24.0.0' 'v2rayNG/1.10.16' 'clash.meta/v1.19.12' 'sing-box 1.12.4'; do
    hdr=$("${C[@]}" -o /tmp/verify-raw.$$ -D - -A "$ua" -H 'accept-encoding: identity' "$URL" | tr -d '\r')
    size=$(wc -c </tmp/verify-raw.$$)
    if grep -q '^HTTP/[0-9.]* 200' <<<"$hdr" && grep -qi '^subscription-userinfo:' <<<"$hdr" && [ "$size" -gt 0 ]; then
        ok "raw [$ua] ${size}B"
    else
        bad "raw [$ua] status/headers/body wrong"
    fi
done
rm -f /tmp/verify-raw.$$
exit $fail
