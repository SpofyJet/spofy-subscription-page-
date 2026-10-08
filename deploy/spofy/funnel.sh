#!/usr/bin/env bash
# Purchase funnel from the page's own log: how many people got each step, by platform.
# Usage: deploy/spofy/funnel.sh [logfile ...]   (default: archived logs + the running container)
# Steps: view → sheet_open → pay_click → checkout created (server) → pay_open → pay_return → pay_done
set -euo pipefail
DIR=/opt/remnawave/subscription
TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
if [ "$#" -gt 0 ]; then cat "$@" > "$TMP"; else
    cat "$DIR"/logs/subpage-*.log 2>/dev/null > "$TMP" || true
    docker logs remnawave-subscription-page 2>&1 | sed 's/\x1b\[[0-9;]*m//g' >> "$TMP"
fi
python3 - "$TMP" <<'PY'
import re, sys, json, collections
events = collections.defaultdict(lambda: collections.defaultdict(set))   # platform -> step -> people
created = collections.defaultdict(set)
since = None
for line in open(sys.argv[1], errors='replace'):
    m = re.search(r'SPOFY_EVENT (\{.*\})', line)
    if m:
        try: d = json.loads(m.group(1))
        except ValueError: continue
        events[d.get('p', 'other')][d['e']].add(d['s'])
        events['all'][d['e']].add(d['s'])
        continue
    # server-side count of created payments: "POST /spofy-api/<uuid>/checkout ... 201"
    m = re.search(r'"POST /spofy-api/([A-Za-z0-9_-]+)/checkout [^"]*" 201', line)
    if m:
        import hashlib
        s = hashlib.sha256(m.group(1).encode()).hexdigest()[:10]
        created['all'].add(s)
steps = ['view', 'sheet_open', 'pay_click', 'pay_open', 'pay_return', 'pay_done', 'pay_back', 'pay_timeout']
names = {'view': 'открыли страницу', 'sheet_open': 'открыли меню', 'pay_click': 'нажали «Оплатить»', 'pay_open': 'открыли оплату',
         'pay_return': 'вернулись с оплаты', 'pay_done': 'подписка обновилась', 'pay_back': 'нажали «Изменить выбор»', 'pay_timeout': 'не дождались'}
cols = [c for c in ['all', 'ios', 'android', 'desktop', 'other'] if events.get(c)]
if not cols:
    print('Событий ещё нет: они появляются после первых визитов с новой версией.'); sys.exit(0)
print('%-28s' % 'Шаг (людей)' + ''.join('%10s' % c for c in cols))
for st in steps:
    print('%-28s' % names[st] + ''.join('%10d' % len(events[c][st]) for c in cols))
print('%-28s%10d' % ('создан платёж (сервер)', len(created['all'])))
base = len(events['all']['view']) or 1
print('\nМеню → оплата: %.0f%%, оплата → готово: %.0f%%, страница → готово: %.1f%%' % (
    100 * len(events['all']['pay_click']) / max(1, len(events['all']['sheet_open'])),
    100 * len(events['all']['pay_done']) / max(1, len(events['all']['pay_open'])),
    100 * len(events['all']['pay_done']) / base))
PY
