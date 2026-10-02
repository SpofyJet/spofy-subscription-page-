# Spofy fork of remnawave/subscription-page

Branded subscription page for `sub.spofyltd.ru`, forked from upstream tag **8.0.0**
(`upstream` remote = `https://github.com/remnawave/subscription-page`).
The raw-subscription path (what VPN clients fetch) is untouched.

## What changed

| Area | Files | Notes |
|---|---|---|
| Backend (additive) | `backend/src/modules/spofy/*`, 3 lines in `webpage.service.ts`, 1 in `webpage.module.ts`, 4 env keys in `config.schema.ts` | Adds `spofy` to the **web page** payload only. |
| Frontend (new) | `frontend/src/spofy/**` | New page: header, status, actions, bypass notice, connect, link/QR/support. |
| Frontend (upstream touch points) | `app.tsx`, `app/router/router.tsx`, `app/layouts/root/root.layout.tsx`, `index.html` | Small edits, see below. |
| Ops | `deploy/spofy/*.sh`, `.dockerignore` | Build / deploy / verify / rollback. |

App lists, store links, deep links and guide texts still come from the panel's Subpage
Builder config — nothing app-specific is hardcoded.

### Upstream touch points (keep these small when merging)
- `app.tsx` — Spofy theme, `defaultColorScheme="auto"`; removed `NavigationProgress` (unlabelled
  progressbar, not used by the new page), `initDayjs()` and the flag-emoji polyfill (not used;
  dayjs was 16 KB gz).
- `router.tsx` — routes to `SpofyMainPage` instead of `MainPageConnector` (upstream widgets stay in
  the tree, unused).
- `root.layout.tsx` — stores the `spofy` payload; static shell instead of the spinner; replaces the
  client-side zod parse of the config with a structural check (the backend already validates the
  same schema at startup) and deep-imports the route constant. Together this removes zod
  (72 KB gz) from the bundle.
- `index.html` — no Google Fonts (Manrope is self-hosted via `@fontsource-variable/manrope`),
  `color-scheme: light dark`, Spofy favicons, zoom allowed, static shield placeholder in `#root`.

## Environment (all optional)

| Variable | Value now | Effect |
|---|---|---|
| `SPOFY_RENEW_URL` | `https://t.me/spofyvpnbot` → later `…?start=renew` | «Продлить подписку». Hidden if unset. |
| `SPOFY_TRAFFIC_URL` | `https://t.me/spofyvpnbot` → later `…?start=traffic` | «Докупить трафик» (only when the tariff has a limit) and the bypass notice button. |
| `SPOFY_SUPPORT_URL` | `https://t.me/spofysup` | Header icon + footer button. Falls back to the config's `brandingSettings.supportUrl`. |
| `SPOFY_BYPASS_OFF_SQUAD_UUID` | *(empty)* | Feature flag. When set, users whose `activeInternalSquads` contain this UUID see «Обходы отключены…». Lookup via the panel API, cached ≤ 60 s per user, 3 s timeout, **fails open** (any error → no notice). |

The stock image ignores unknown variables, so adding them before the swap (and keeping them
after a rollback) is safe.

## Design deviations from the brief (with reasons)
- **Text-safe colour variants.** Warning / success / error on white and the accent on the dark
  surface fail AA as *text*. Fills (dots, bars, buttons) use the brand values; text uses
  `--sp-*-text` variants (light: `#9A5B00`, `#137A4B`, `#C4262B`; dark accent text `#7C9DFF`).
- **Logo.** The panel's `logoUrl` is the «SPOFY» wordmark; the shield is its «O». The page uses
  that shield path inline (no third-party CDN request). Title comes from `brandingSettings.title`.
- **App icons** in the config are white-on-transparent, so their tile stays dark in both themes.
- No tariff name in `GetSubscriptionInfoByShortUuid`; the status card shows the username.

## Develop / test
```bash
# frontend dev build + typecheck (Docker only, no host Node needed)
docker run --rm -v $PWD:/src -w /src/frontend node:24.18-trixie-slim sh -c 'npm ci && npx tsc --noEmit && npm run start:build'
# backend typecheck + unit tests for the Spofy service
docker run --rm -v $PWD:/src -w /src/backend node:24.18-trixie-slim sh -c 'npm ci && npx tsc --noEmit && npx -y tsx@4 --tsconfig tsconfig.json --test test/spofy.service.test.ts'
```
Panel test user: `spofy_subpage_test` (tag `SUBPAGE_TEST`, `Default-Squad`) →
`https://sub.spofyltd.ru/Qf_Wtzcw6JXrffn0`. Never test with a customer's link.

## Runbook (on `significant-fuchsia`)

**Build**
```bash
cd /opt/spofy-subscription-page && git pull && deploy/spofy/build.sh      # → spofy-subpage:<sha>
```

**Env** — append once to `/opt/remnawave/subscription/.env`:
```
SPOFY_RENEW_URL=https://t.me/spofyvpnbot
SPOFY_TRAFFIC_URL=https://t.me/spofyvpnbot
SPOFY_SUPPORT_URL=https://t.me/spofysup
SPOFY_BYPASS_OFF_SQUAD_UUID=
```

**Deploy** — tags the running image as `spofy-subpage:prev`, backs up the compose file, swaps:
```bash
deploy/spofy/deploy.sh <sha>
```

**Verify** through the origin (Mitelis blocks curl on the public address):
```bash
deploy/spofy/verify.sh Qf_Wtzcw6JXrffn0          # all PASS = page, payload, zstd, raw subs OK
```
Then open the test link on a phone (dark + light).

**Rollback**
```bash
deploy/spofy/rollback.sh                        # runs spofy-subpage:prev, waits for healthy
```
Caddy is not touched (it keeps `encode zstd gzip`).

**Turn on the bypass notice** (after the panel/bot task creates the marker squad): set
`SPOFY_BYPASS_OFF_SQUAD_UUID=<uuid>` in `.env`, then `cd /opt/remnawave/subscription && docker compose up -d`.

## Merging a new upstream release
```bash
git fetch upstream --tags
git checkout -b merge/<ver> main && git merge <ver>   # resolve the 4 touch points above
```
Re-run the tests, the raw-subscription comparison and the screenshots before deploying.
