/**
 * Preview stand data: a realistic panel payload, Subpage Builder config and bot offer for every
 * subscription state. Used only by `vite.preview.config.ts` (never by the production build).
 */

const GB = 1024 ** 3
const DAY = 86_400_000

/** Where each subscription ends — the same moment for the panel and the bot, as in production. */
export function endOf(scenario: string, now = Date.now()): number {
    if (scenario === 'expired') return now - 3 * DAY
    if (scenario === 'expiring') return now + 2 * DAY + 3600_000
    if (scenario === 'trial') return now + 2 * DAY + 5 * 3600_000
    // ULTIMA «навсегда»: the bot writes it as 2222 days
    if (scenario === 'ultima') return now + 2222 * DAY
    return now + 24 * DAY + 3 * 3600_000
}

const icon = (d: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`

const svgLibrary: Record<string, string> = {
    apple: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16.37 12.73c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.59 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM14.2 6.27c.6-.73 1.01-1.75.9-2.77-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.69.97.07 1.96-.49 2.56-1.23z"/></svg>`,
    android: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.86 3.22a11.4 11.4 0 0 0-9.84 0L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z"/></svg>`,
    windows: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5l7.5-1v7H3zm8.5-1.2L21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zm8.5 0H21V21l-9.5-1.3z"/></svg>`,
    macos: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>`,
    tv: icon('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>'),
    download: icon('<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>'),
    plus: icon('<path d="M12 5v14M5 12h14"/>'),
    power: icon('<path d="M12 3v9"/><path d="M6.3 7.3a8 8 0 1 0 11.4 0"/>'),
    copy: icon(
        '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'
    ),
    happ: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fff"><path d="M6 4h3v6.5h6V4h3v16h-3v-6.5H9V20H6z"/></svg>`,
    v2raytun: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fff"><path d="M4 5h3l5 10 5-10h3l-7 14h-2z"/></svg>`,
    hiddify: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="7" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="12" cy="12" r="2.5"/></svg>`,
    incy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fff"><path d="M8 4h3v16H8zM13 4h3v16h-3z"/></svg>`
}

const L = (ru: string, en: string) => ({ ru, en })

type TButtonType = 'copyButton' | 'external' | 'subscriptionLink'
const button = (
    type: TButtonType,
    link: string,
    text: { en: string; ru: string },
    svgIconKey: string
) => ({
    type,
    link,
    text,
    svgIconKey
})

function guide(
    appName: string,
    store: { link: string; text: { en: string; ru: string } },
    deepLink: string,
    extra: ReturnType<typeof button>[] = []
) {
    return [
        {
            svgIconKey: 'download',
            svgIconColor: 'cyan',
            title: L(`Установите ${appName}`, `Install ${appName}`),
            description: L(
                `Откройте магазин приложений и установите ${appName}. При первом запуске разрешите добавить VPN-конфигурацию.`,
                `Open the store and install ${appName}. On first launch allow it to add a VPN configuration.`
            ),
            buttons: [button('external', store.link, store.text, 'download'), ...extra]
        },
        {
            svgIconKey: 'plus',
            svgIconColor: 'violet',
            title: L('Добавьте подписку', 'Add the subscription'),
            description: L(
                'Нажмите кнопку ниже — приложение откроется и добавит подписку само. Если не открылось, скопируйте ссылку и вставьте её в приложении через «+».',
                'Tap the button below — the app opens and adds the subscription. If it does not, copy the link and paste it in the app via «+».'
            ),
            buttons: [
                button(
                    'subscriptionLink',
                    deepLink,
                    L('Добавить подписку', 'Add subscription'),
                    'plus'
                ),
                button(
                    'copyButton',
                    '{{SUBSCRIPTION_LINK}}',
                    L('Скопировать ссылку', 'Copy link'),
                    'copy'
                )
            ]
        },
        {
            svgIconKey: 'power',
            svgIconColor: 'green',
            title: L('Включите VPN', 'Turn on the VPN'),
            description: L(
                'В приложении выберите сервер и нажмите большую кнопку подключения. Готово — интернет работает через Spofy.',
                'Pick a server in the app and press the big connect button. Done — you are online through Spofy.'
            ),
            buttons: []
        }
    ]
}

const appStore = {
    link: 'https://apps.apple.com/app/happ-proxy-utility/id6504287215',
    text: L('App Store', 'App Store')
}
const googlePlay = (id: string) => ({
    link: `https://play.google.com/store/apps/details?id=${id}`,
    text: L('Google Play', 'Google Play')
})

export const appConfig = {
    version: '1',
    locales: ['ru', 'en'],
    brandingSettings: {
        title: 'Spofy VPN',
        logoUrl: '',
        supportUrl: 'https://t.me/spofysup'
    },
    uiConfig: { subscriptionInfoBlockType: 'cards', installationGuidesBlockType: 'timeline' },
    baseSettings: {
        metaTitle: 'Spofy VPN',
        metaDescription: 'Spofy VPN',
        showConnectionKeys: false,
        hideGetLinkButton: false
    },
    baseTranslations: Object.fromEntries(
        [
            'installationGuideHeader',
            'connectionKeysHeader',
            'linkCopied',
            'linkCopiedToClipboard',
            'getLink',
            'scanQrCode',
            'scanQrCodeDescription',
            'copyLink',
            'name',
            'status',
            'active',
            'inactive',
            'expires',
            'bandwidth',
            'scanToImport',
            'expiresIn',
            'expired',
            'unknown',
            'indefinitely'
        ].map((key) => [key, L(key, key)])
    ),
    svgLibrary,
    platforms: {
        ios: {
            displayName: L('iPhone / iPad', 'iPhone / iPad'),
            svgIconKey: 'apple',
            apps: [
                {
                    name: 'Happ',
                    svgIconKey: 'happ',
                    featured: true,
                    blocks: guide('Happ', appStore, 'happ://add/{{SUBSCRIPTION_LINK}}')
                },
                {
                    name: 'INCY',
                    svgIconKey: 'incy',
                    featured: false,
                    blocks: guide(
                        'INCY',
                        {
                            link: 'https://apps.apple.com/app/incy/id6756943388',
                            text: L('App Store', 'App Store')
                        },
                        'incy://import/{{SUBSCRIPTION_LINK}}'
                    )
                },
                {
                    name: 'v2RayTun',
                    svgIconKey: 'v2raytun',
                    featured: false,
                    blocks: guide(
                        'v2RayTun',
                        {
                            link: 'https://apps.apple.com/app/v2raytun/id6476628951',
                            text: L('App Store', 'App Store')
                        },
                        'v2raytun://import/{{SUBSCRIPTION_LINK}}'
                    )
                }
            ]
        },
        android: {
            displayName: L('Android', 'Android'),
            svgIconKey: 'android',
            apps: [
                {
                    name: 'Happ',
                    svgIconKey: 'happ',
                    featured: true,
                    blocks: guide(
                        'Happ',
                        googlePlay('com.happproxy'),
                        'happ://add/{{SUBSCRIPTION_LINK}}',
                        [
                            button(
                                'external',
                                'https://github.com/Happ-proxy/happ-android/releases/latest',
                                L('Скачать APK', 'Download APK'),
                                'download'
                            )
                        ]
                    )
                },
                {
                    name: 'v2RayTun',
                    svgIconKey: 'v2raytun',
                    featured: false,
                    blocks: guide(
                        'v2RayTun',
                        googlePlay('com.v2raytun.android'),
                        'v2raytun://import/{{SUBSCRIPTION_LINK}}'
                    )
                }
            ]
        },
        windows: {
            displayName: L('Windows', 'Windows'),
            svgIconKey: 'windows',
            apps: [
                {
                    name: 'Happ',
                    svgIconKey: 'happ',
                    featured: true,
                    blocks: guide(
                        'Happ',
                        {
                            link: 'https://github.com/Happ-proxy/happ-desktop/releases/latest',
                            text: L('Скачать для Windows', 'Download for Windows')
                        },
                        'happ://add/{{SUBSCRIPTION_LINK}}'
                    )
                },
                {
                    name: 'Hiddify',
                    svgIconKey: 'hiddify',
                    featured: false,
                    blocks: guide(
                        'Hiddify',
                        {
                            link: 'https://github.com/hiddify/hiddify-app/releases/latest',
                            text: L('Скачать', 'Download')
                        },
                        'hiddify://import/{{SUBSCRIPTION_LINK}}'
                    )
                }
            ]
        },
        macos: {
            displayName: L('macOS', 'macOS'),
            svgIconKey: 'macos',
            apps: [
                {
                    name: 'Happ',
                    svgIconKey: 'happ',
                    featured: true,
                    blocks: guide('Happ', appStore, 'happ://add/{{SUBSCRIPTION_LINK}}')
                }
            ]
        },
        androidTV: {
            displayName: L('Android TV', 'Android TV'),
            svgIconKey: 'tv',
            apps: [
                {
                    name: 'Happ',
                    svgIconKey: 'happ',
                    featured: true,
                    blocks: guide(
                        'Happ',
                        googlePlay('com.happproxy'),
                        'happ://add/{{SUBSCRIPTION_LINK}}'
                    )
                }
            ]
        }
    }
}

export type TScenario =
    | 'active'
    | 'bypass'
    | 'devicesfull'
    | 'expired'
    | 'expiring'
    | 'limited'
    | 'lowtraffic'
    | 'nocheckout'
    | 'nodevices'
    | 'trial'
    | 'ultima'
    | 'unlimited'

export const SCENARIOS: TScenario[] = [
    'active',
    'trial',
    'expiring',
    'expired',
    'limited',
    'bypass',
    'lowtraffic',
    'devicesfull',
    'nodevices',
    'unlimited',
    'ultima',
    'nocheckout'
]

export function panelPayload(scenario: TScenario, shortUuid: string) {
    const now = Date.now()
    const base = {
        shortUuid,
        username: 'tg_482913377',
        trafficUsed: '',
        trafficLimit: '',
        lifetimeTrafficUsed: '',
        lifetimeTrafficUsedBytes: String(Math.round(61.4 * GB)),
        isActive: true,
        trafficLimitStrategy: 'MONTH' as string,
        userStatus: 'ACTIVE' as string,
        daysLeft: 24,
        expiresAt: new Date(endOf(scenario, now)).toISOString(),
        trafficUsedBytes: String(Math.round(23.4 * GB)),
        trafficLimitBytes: String(100 * GB)
    }
    const spofy = {
        bypassDisabled: false,
        checkoutEnabled: true,
        cabinetUrl: 'https://web.spofyltd.ru',
        devicesLimit: 3 as null | number,
        devicesUsed: 2 as null | number,
        displayName: '@ivan_petrov',
        renewUrl: 'https://t.me/spofyvpnbot',
        supportUrl: 'https://t.me/spofysup',
        trafficUrl: 'https://t.me/spofyvpnbot'
    }
    const user = { ...base }
    switch (scenario) {
        case 'trial':
            Object.assign(user, {
                daysLeft: 2,
                expiresAt: new Date(endOf(scenario, now)).toISOString(),
                trafficUsedBytes: String(Math.round(1.2 * GB)),
                trafficLimitBytes: '0'
            })
            Object.assign(spofy, { devicesLimit: 1, devicesUsed: 1 })
            break
        case 'expiring':
            Object.assign(user, {
                daysLeft: 2,
                expiresAt: new Date(endOf(scenario, now)).toISOString()
            })
            break
        case 'expired':
            Object.assign(user, {
                userStatus: 'EXPIRED',
                isActive: false,
                daysLeft: 0,
                expiresAt: new Date(endOf(scenario, now)).toISOString()
            })
            break
        case 'limited':
            Object.assign(user, {
                userStatus: 'LIMITED',
                trafficUsedBytes: String(100 * GB),
                trafficLimitStrategy: 'NO_RESET'
            })
            break
        case 'bypass':
            Object.assign(user, { trafficUsedBytes: String(100 * GB) })
            Object.assign(spofy, { bypassDisabled: true })
            break
        case 'lowtraffic':
            Object.assign(user, { trafficUsedBytes: String(Math.round(88.6 * GB)) })
            break
        case 'nodevices':
            Object.assign(user, { trafficUsedBytes: '0' })
            Object.assign(spofy, { devicesUsed: 0, devicesLimit: 3 })
            break
        case 'devicesfull':
            Object.assign(spofy, { devicesUsed: 3, devicesLimit: 3 })
            break
        case 'unlimited':
            Object.assign(user, {
                trafficLimitBytes: '0',
                trafficUsedBytes: String(Math.round(87.3 * GB))
            })
            Object.assign(spofy, { devicesLimit: 5, devicesUsed: 1 })
            break
        case 'ultima':
            Object.assign(user, {
                daysLeft: 2222,
                trafficLimitBytes: '0',
                trafficUsedBytes: String(Math.round(140.2 * GB))
            })
            Object.assign(spofy, { devicesLimit: 5, devicesUsed: 2 })
            break
        case 'nocheckout':
            Object.assign(spofy, { checkoutEnabled: false })
            break
        default:
            break
    }
    return {
        response: {
            isFound: true,
            user,
            links: [],
            ssConfLinks: {},
            subscriptionUrl: `https://sub.spofyltd.ru/${shortUuid}`
        },
        spofy
    }
}

const methods = [
    {
        id: 'platega',
        name: '💳 Карта / СБП',
        description: 'Банковская карта или СБП',
        min_amount_kopeks: 10_000,
        max_amount_kopeks: 10_000_000,
        options: [
            { id: 'sbp', name: 'СБП' },
            { id: 'card', name: 'Карта' }
        ]
    },
    {
        id: 'heleket',
        name: '🪙 Криптовалюта Heleket',
        description: 'USDT, TON, BTC',
        min_amount_kopeks: 10_000,
        max_amount_kopeks: 10_000_000,
        options: null
    },
    {
        id: 'telegram_stars',
        name: '⭐ Telegram Stars',
        description: 'Оплата звёздами в Telegram',
        min_amount_kopeks: 100,
        max_amount_kopeks: 10_000_000,
        options: null
    },
    {
        id: 'yookassa',
        name: 'ЮKassa',
        description: 'Карты РФ, SberPay',
        min_amount_kopeks: 10_000,
        max_amount_kopeks: 10_000_000,
        options: null
    }
]

/* Real Spofy tariffs (bot admin screenshots, 22.10.2026). Device prices and trial terms are not
   known yet — the device quotes below are test numbers. */
const p = (period_days: number, rub: number) => ({ period_days, price_kopeks: rub * 100 })
const STANDARD = [p(14, 119), p(30, 159), p(60, 279), p(90, 359), p(180, 689), p(365, 1290)]
const BYPASS = [p(30, 270), p(60, 495), p(90, 720), p(180, 1135), p(365, 1800)]
const ULTIMA = [p(2222, 5000)]
const TRAFFIC_PACKS = [
    { gb: 50, price_kopeks: 15_000 },
    { gb: 100, price_kopeks: 30_000 },
    { gb: 150, price_kopeks: 45_000 }
]

export function offer(scenario: TScenario) {
    const trial = scenario === 'trial'
    const now = Date.now()
    const end = endOf(scenario, now)
    return {
        checkout_enabled: true,
        disabled_reason: null,
        restriction: null,
        subscription: {
            device_limit: trial ? 1 : scenario === 'ultima' ? 5 : 3,
            end_date: new Date(end).toISOString(),
            is_trial: trial,
            status: scenario === 'expired' ? 'expired' : trial ? 'trial' : 'active',
            tariff_id: trial ? null : 1,
            tariff_name: trial
                ? null
                : scenario === 'ultima'
                  ? '👑 ULTIMA'
                  : scenario === 'unlimited'
                    ? '⭐️ Стандартный'
                    : '🏴‍☠️ С обходами',
            traffic_limit_gb: trial || scenario === 'unlimited' || scenario === 'ultima' ? 0 : 100
        },
        renewal: trial
            ? []
            : scenario === 'ultima'
              ? ULTIMA
              : scenario === 'unlimited'
                ? STANDARD
                : BYPASS,
        tariffs: trial
            ? [
                  {
                      id: 1,
                      name: '⭐️ Стандартный',
                      description: 'Безлимитный трафик на обычных серверах',
                      device_limit: 3,
                      traffic_limit_gb: 0,
                      periods: STANDARD
                  },
                  {
                      id: 2,
                      name: '🏴‍☠️ С обходами',
                      description: '100 ГБ в месяц на серверы «Обход» + безлимит на обычных',
                      device_limit: 3,
                      traffic_limit_gb: 100,
                      periods: BYPASS
                  },
                  {
                      id: 3,
                      name: '👑 ULTIMA',
                      description: 'Без ограничений: 5 устройств, безлимитный трафик везде',
                      device_limit: 5,
                      traffic_limit_gb: 0,
                      periods: ULTIMA
                  }
              ]
            : [],
        devices: trial
            ? { available: false, reason: 'trial' }
            : {
                  available: true,
                  can_add: 5,
                  current_device_limit: scenario === 'ultima' ? 5 : 3,
                  base_device_price_kopeks: 9_900,
                  days_left: 24,
                  quotes: [1, 2, 3, 4, 5].map((n) => ({
                      devices: n,
                      total_price_kopeks: n * 7_900
                  }))
              },
        traffic: trial || scenario === 'unlimited' || scenario === 'ultima' ? [] : TRAFFIC_PACKS,
        payment_methods: methods
    }
}
