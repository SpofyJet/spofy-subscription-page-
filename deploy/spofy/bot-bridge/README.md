# Spofy checkout bridge for the Bedolaga bot

Lets sub.spofyltd.ru sell renewals, devices, traffic and tariffs (for trial users) without a login.
The bridge **never spends the user's balance**: it saves a cart exactly like the cabinet does on
insufficient funds and creates a top-up for the full price with the chosen payment method. The bot's
standard auto-purchase-after-top-up completes the cart when the payment lands.

Written against bot v5.0.0 (`5bda3c5`). Files: `spofy_subpage.py` → `app/cabinet/routes/`,
`test_spofy_subpage.py` → `tests/cabinet/`, plus two lines in `app/cabinet/routes/__init__.py`.

## Install (on botcomplete)
```bash
cd /opt/remnawave-bedolaga-telegram-bot
git checkout -b spofy/subpage-bridge
git am /path/to/0001-spofy-subpage-bridge.patch      # or copy the two files + 2 lines by hand
uv run pytest tests/cabinet/test_spofy_subpage.py -q  # must be green before deploy
```
Bot `.env`:
```
SPOFY_SUBPAGE_API_KEY=<random, ≥ 32 chars — same value as SPOFY_BOT_API_KEY on the subpage server>
AUTO_PURCHASE_AFTER_TOPUP_ENABLED=true   # required: completes the cart after payment
```
Rebuild/restart the bot the way it is normally deployed.

## Subscription-page server
```
SPOFY_BOT_API_URL=https://<address the subpage server can reach the bot's cabinet API on>
SPOFY_BOT_API_KEY=<same key>
```
Without these two variables the page keeps the plain «Продлить → bot» links.

## Endpoints (server-to-server, header `X-Spofy-Subpage-Key`)
- `GET  /cabinet/spofy-subpage/{short_uuid}/offer`
- `POST /cabinet/spofy-subpage/{short_uuid}/checkout`
- `GET  /cabinet/spofy-subpage/{short_uuid}/payments/{method}/{payment_id}?active=0|1`

Not supported in v1 (the page sends these users to the cabinet): multi-tariff mode, daily tariffs,
custom days/traffic, paid trial.
