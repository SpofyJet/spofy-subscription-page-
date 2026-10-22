/**
 * Local preview stand — every subscription state without a panel or a bot.
 *
 *   npx vite --config dev-preview/vite.preview.config.ts
 *   open http://localhost:3334/active/demo7Kx2pQ9mZ4aB   (active | trial | expiring | expired |
 *     limited | bypass | lowtraffic | devicesfull | nodevices | unlimited | nocheckout | invalid)
 *
 * Dev-only: not used by `npm run start:build` and not copied into the Docker image.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig, type Plugin } from 'vite'

import { renderNotFoundPage } from '../../backend/src/modules/spofy/not-found.page'
import baseConfig from '../vite.config'
import { appConfig, offer, panelPayload, SCENARIOS, type TScenario } from './mock-data'

const scenarioOf = (url: string): TScenario => {
    const first = url.split('?')[0]!.split('/').filter(Boolean)[0] as TScenario
    return SCENARIOS.includes(first) ? first : 'active'
}

const json = (res: ServerResponse, body: unknown, status = 200) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
}

const readBody = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
        let data = ''
        req.on('data', (chunk) => (data += chunk))
        req.on('end', () => resolve(data))
    })

/** payment id → polls seen, so the stand can show «paid → done» */
const polls = new Map<string, number>()
/** payment id → what was bought, so «Оплачено до …» matches the purchase */
const bought = new Map<string, { days?: number; devices?: number; gb?: number; kind: string }>()

function previewPlugin(): Plugin {
    return {
        name: 'spofy-preview',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const url = req.url ?? '/'
                if (url.startsWith('/assets/.app-config-v2.json')) return json(res, appConfig)
                // /invalid/<anything> — what the backend answers for a link that no longer exists
                if (/^\/invalid(\/|$)/.test(url) && !url.includes('spofy-api')) {
                    res.statusCode = 404
                    res.setHeader('content-type', 'text/html; charset=utf-8')
                    return res.end(
                        renderNotFoundPage({
                            acceptLanguage: req.headers['accept-language'],
                            botUrl: 'https://t.me/spofyvpnbot',
                            supportUrl: 'https://t.me/spofysup'
                        })
                    )
                }

                const api = url.match(/\/spofy-api\/([^/?]+)\/([^?]*)/)
                if (!api) return next()
                const scenario = scenarioOf(url)
                const action = api[2]!
                const delay = Number(new URL(url, 'http://x').searchParams.get('delay') ?? 350)
                await new Promise((r) => setTimeout(r, delay))

                if (action === 'event') return json(res, { ok: true })
                if (action === 'offer') return json(res, offer(scenario))
                if (action === 'checkout') {
                    const body = JSON.parse((await readBody(req)) || '{}')
                    const o = offer(scenario)
                    const price =
                        body.kind === 'renew'
                            ? o.renewal.find((p) => p.period_days === body.period_days)
                                  ?.price_kopeks
                            : body.kind === 'tariff'
                              ? o.tariffs
                                    .find((t) => t.id === body.tariff_id)
                                    ?.periods.find((p) => p.period_days === body.period_days)
                                    ?.price_kopeks
                              : body.kind === 'traffic'
                                ? o.traffic.find((p) => p.gb === body.traffic_gb)?.price_kopeks
                                : body.devices * 7_900
                    const paymentId = `pay_${Date.now()}`
                    bought.set(paymentId, {
                        kind: body.kind,
                        days: body.period_days,
                        devices: body.devices,
                        gb: body.traffic_gb
                    })
                    return json(res, {
                        amount_kopeks: price ?? 14_900,
                        price_kopeks: price ?? 14_900,
                        before: o.subscription,
                        method: body.payment_method,
                        payment_id: paymentId,
                        payment_url: 'https://example.com/pay',
                        qr_payload: null
                    })
                }
                if (action.startsWith('payments/')) {
                    const id = action.split('/').at(-1)!
                    const n = (polls.get(id) ?? 0) + 1
                    polls.set(id, n)
                    const o = offer(scenario)
                    const paid = n >= 3
                    const applied = n >= 4
                    const what = bought.get(id)
                    const base = o.subscription.end_date
                        ? Math.max(Date.parse(o.subscription.end_date), Date.now())
                        : Date.now()
                    return json(res, {
                        is_paid: paid,
                        status_text: null,
                        subscription: applied
                            ? {
                                  ...o.subscription,
                                  is_trial: false,
                                  tariff_id: what?.kind === 'tariff' ? 2 : 1,
                                  device_limit: o.subscription.device_limit + (what?.devices ?? 0),
                                  traffic_limit_gb:
                                      o.subscription.traffic_limit_gb + (what?.gb ?? 0),
                                  end_date: what?.days
                                      ? new Date(
                                            (what.kind === 'tariff' ? Date.now() : base) +
                                                what.days * 86_400_000
                                        ).toISOString()
                                      : o.subscription.end_date
                              }
                            : o.subscription
                    })
                }
                return json(res, { code: 'not_found' }, 404)
            })
        },
        transformIndexHtml: {
            order: 'post',
            handler(html, ctx) {
                const url = ctx.originalUrl ?? ctx.path ?? '/'
                const segments = url.split('?')[0]!.split('/').filter(Boolean)
                const shortUuid = segments.at(-1) ?? 'demo7Kx2pQ9mZ4aB'
                const payload = Buffer.from(
                    JSON.stringify(panelPayload(scenarioOf(url), shortUuid))
                ).toString('base64')
                return html
                    .replace(/data-panel="[^"]*"/, `data-panel="${payload}"`)
                    .replace(/<title>[^<]*<\/title>/, '<title>Spofy VPN</title>')
            }
        }
    }
}

export default mergeConfig(
    baseConfig,
    defineConfig({
        root: fileURLToPath(new URL('..', import.meta.url)),
        plugins: [previewPlugin()],
        appType: 'spa'
    })
)
