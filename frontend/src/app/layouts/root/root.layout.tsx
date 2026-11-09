// Spofy: deep import — the package entry is CommonJS and drags in every zod schema
import { APP_CONFIG_ROUTE_LEADING_PATH } from '@remnawave/subscription-page-types/build/backend/constants'
import { TSubscriptionPageRawConfig } from '@remnawave/subscription-page-types'
import { GetSubscriptionInfoByShortUuidCommand } from '@remnawave/backend-contract'
import { ReactNode, useEffect, useLayoutEffect, useState } from 'react'

import {
    useSubscriptionInfoStoreActions,
    useSubscriptionInfoStoreInfo
} from '@entities/subscription-info-store'
import {
    detectLanguage,
    useAppConfigStoreActions,
    useIsConfigLoaded
} from '@entities/app-config-store'
import { isUsableConfig, SpofyShell, useSpofyStore } from '../../../spofy'
import { SpofyFallback } from '../../../spofy/spofy-fallback'
import { ensureLocale } from '../../../spofy/i18n'

/** How long the shield may stay before we admit the load failed. */
const STALLED_AFTER_MS = 8000

import classes from './root.module.css'

/** The config is fetched once more if the first attempt fails: one network blip is common. */
async function fetchJson(url: string): Promise<unknown> {
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const response = await fetch(url)
            if (response.ok) return await response.json()
            lastError = new Error(`HTTP ${response.status}`)
        } catch (error) {
            lastError = error
        }
    }
    throw lastError
}

export function RootLayout({ children }: { children: ReactNode }) {
    const subscriptionActions = useSubscriptionInfoStoreActions()
    const configActions = useAppConfigStoreActions()

    const { subscription } = useSubscriptionInfoStoreInfo()
    const isConfigLoaded = useIsConfigLoaded()
    const isReady = isConfigLoaded && !!subscription
    const [stalled, setStalled] = useState(false)

    // Config fetch failed or the page data was broken: say so instead of an endless shield.
    useEffect(() => {
        if (isReady) return undefined
        const timer = window.setTimeout(() => setStalled(true), STALLED_AFTER_MS)
        return () => window.clearTimeout(timer)
    }, [isReady])

    useLayoutEffect(() => {
        const subPageDiv = document.getElementById('sbpg')
        const configVersion = subPageDiv?.dataset.config || String(Date.now())

        // Starts the language file early for people who will need it; Russian is built in.
        void ensureLocale(detectLanguage(['ru', 'en']))

        if (subPageDiv) {
            const subscriptionUrl = subPageDiv.dataset.panel

            if (subscriptionUrl) {
                try {
                    // atob() decodes as Latin-1 and would corrupt non-ASCII (Cyrillic names)
                    const bytes = Uint8Array.from(atob(subscriptionUrl), (char) =>
                        char.charCodeAt(0)
                    )
                    const subscription: GetSubscriptionInfoByShortUuidCommand.Response =
                        JSON.parse(new TextDecoder().decode(bytes))

                    subscriptionActions.setSubscriptionInfo({
                        subscription: subscription.response
                    })
                    useSpofyStore.getState().setFromPanelPayload(subscription)
                } catch (error) {
                    console.error(error)
                } finally {
                    subPageDiv.remove()
                }
            }
        }

        const fetchConfig = async () => {
            try {
                // The same URL as <link rel="preload"> in index.html: the request is already on
                // its way, or served from the browser cache while the config has not changed.
                const tempConfig = await fetchJson(
                    `${APP_CONFIG_ROUTE_LEADING_PATH}?v=${configVersion}`
                )

                // Spofy: the backend already validates this config with the same zod schema at
                // startup; skipping the client-side parse keeps zod (~70 KB gz) out of the bundle.
                if (!isUsableConfig(tempConfig)) {
                    console.error('Failed to parse app config')
                    return
                }

                const config = tempConfig as TSubscriptionPageRawConfig
                await ensureLocale(detectLanguage(config.locales))
                configActions.setConfig(config)
            } catch (error) {
                console.error('Failed to fetch app config:', error)
            }
        }

        fetchConfig()
    }, [])

    if (!isReady) {
        if (stalled) return <SpofyFallback kind="stalled" />
        return (
            <div className={classes.root}>
                <div className={classes.content}>
                    <main className={classes.main}>
                        <SpofyShell />
                    </main>
                </div>
            </div>
        )
    }

    return (
        <div className={classes.root}>
            <div className={classes.content}>
                <main className={classes.main}>
                    {children}
                </main>
            </div>
        </div>
    )
}
