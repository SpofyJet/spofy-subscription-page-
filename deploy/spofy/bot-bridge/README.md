# Покупки на странице подписки — модуль для бота Bedolaga

Даёт sub.spofyltd.ru продавать продление, устройства, трафик и тариф (для пробного периода)
прямо на странице, без входа в кабинет.

## Как это работает
1. Человек на странице выбирает, что купить, и способ оплаты.
2. Модуль в боте сохраняет корзину с пометкой `source: 'spofy_subpage'` и создаёт платёж на полную
   сумму через те же функции, что и кабинет (все платёжки, скидки и промогруппы — как в кабинете).
3. После оплаты бот выполняет **только эту покупку** — ровно на оплаченную сумму.

Общий переключатель бота `AUTO_PURCHASE_AFTER_TOPUP_ENABLED` **не нужен и должен оставаться выключен**:
обычные пополнения и корзины из бота/кабинета работают как раньше, деньги на балансе пользователя
модуль никогда не тратит.

Сделано для бота **v5.0.0** (`5bda3c5`). Что меняется в боте:

| Файл | Что |
|---|---|
| `app/cabinet/routes/spofy_subpage.py` | новый: API для страницы подписки |
| `app/services/spofy_subpage_service.py` | новый: завершение покупок со страницы после оплаты |
| `app/cabinet/routes/__init__.py` | +2 строки: подключение API |
| `app/services/payment/common.py` | +5 строк: после оплаты вызвать завершение покупок со страницы |
| `tests/cabinet/test_spofy_subpage.py` | новый: 23 теста |

---

## Установка (на сервере бота — botcomplete)

### 1. Резервная копия
```bash
cd /opt/remnawave-bedolaga-telegram-bot
git status                      # не должно быть своих незакоммиченных правок
git log -1 --oneline            # запомните коммит — к нему откатываться
source .env 2>/dev/null; docker exec remnawave_bot_db \
  pg_dump -U "${POSTGRES_USER:-remnawave_user}" "${POSTGRES_DB:-remnawave_bot}" \
  > /root/bot_db_before_spofy_$(date +%Y%m%d_%H%M).sql
```

### 2. Скачать и проверить патч
```bash
curl -fsSLo /root/spofy-subpage-bridge.patch \
  https://raw.githubusercontent.com/SpofyJet/spofy-subscription-page-/spofy/redesign/deploy/spofy/bot-bridge/0001-spofy-subpage-bridge.patch
git apply --check /root/spofy-subpage-bridge.patch && echo "патч подходит"
```
Если `git apply --check` ругается — версия бота отличается от v5.0.0. Пришлите вывод
`git log -1 --oneline` — подгоню патч.

### 3. Применить
```bash
git checkout -b spofy/subpage-bridge
git -c user.name=spofy -c user.email=spofy@localhost am /root/spofy-subpage-bridge.patch
```

### 4. Прогнать тесты (одноразовый контейнер, бот не трогает)
```bash
docker run --rm -v "$PWD":/src -w /src ghcr.io/astral-sh/uv:python3.14-trixie-slim \
  sh -c 'uv sync --frozen --all-groups -q && uv run pytest tests/cabinet/test_spofy_subpage.py -q'
rm -rf .venv
```
Должно быть `23 passed`. Если нет — не продолжайте, пришлите вывод.

### 5. Ключ
```bash
KEY=$(openssl rand -hex 32); echo "$KEY"          # сохраните — он же нужен серверу страницы
echo "SPOFY_SUBPAGE_API_KEY=$KEY" >> .env
grep -n AUTO_PURCHASE_AFTER_TOPUP_ENABLED .env    # должно быть false или отсутствовать
```

### 6. Пересобрать и запустить бота
```bash
docker compose up -d --build bot
docker compose logs --tail 50 bot                 # без ошибок при старте
```

### 7. Проверить на месте
Возьмите **свою** ссылку подписки (пользователь должен быть в боте): `https://sub.spofyltd.ru/<КОД>`.
```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/cabinet/spofy-subpage/<КОД>/offer
#   401 — без ключа, это правильно
curl -s -H "X-Spofy-Subpage-Key: $KEY" http://127.0.0.1:8080/cabinet/spofy-subpage/<КОД>/offer | head -c 400; echo
#   JSON с ценами и способами оплаты
```

### 8. Доступ с сервера страницы
Сервер страницы (`141.98.7.217`) будет ходить на **origin** бота напрямую, мимо Mitelis, по HTTPS
на тот же Caddy, что обслуживает web.spofyltd.ru. Нужно:
- разрешить входящий 443 на botcomplete с `141.98.7.217` (если стоит фильтр портов/только Mitelis);
- прислать мне **IP сервера бота** и убедиться, что API кабинета доступен как
  `https://web.spofyltd.ru/api/cabinet/...` (стандартная схема: Caddy проксирует `/api/*` в бота :8080).

Проверка с сервера страницы (подставьте IP бота):
```bash
curl -s -o /dev/null -w '%{http_code}\n' --resolve web.spofyltd.ru:443:<IP_БОТА> \
  https://web.spofyltd.ru/api/cabinet/spofy-subpage/<КОД>/offer      # 401 = дошли до модуля
```

### 9. Включить на странице (делаю я после вашего «да»)
В `/opt/remnawave/subscription/.env`:
```
SPOFY_BOT_API_URL=https://web.spofyltd.ru/api
SPOFY_BOT_API_IP=<IP_БОТА>
SPOFY_BOT_API_KEY=<тот же KEY>
```
затем выкладка новой версии страницы и живая проверка платежа.

---

## Откат
```bash
cd /opt/remnawave-bedolaga-telegram-bot
git checkout <прежняя_ветка_или_коммит>   # из шага 1
docker compose up -d --build bot
```
Достаточно и просто удалить `SPOFY_SUBPAGE_API_KEY` из `.env` и перезапустить бота — API модуля
станет недоступным (404), страница вернётся к ссылкам на бота.

## При обновлении бота
```bash
git fetch origin && git rebase origin/main spofy/subpage-bridge   # или заново шаги 2–4
```

## Чего пока нет
Режим нескольких подписок у одного пользователя, суточные тарифы, свои дни/гигабайты, платный
триал — таким пользователям страница предложит кабинет.
