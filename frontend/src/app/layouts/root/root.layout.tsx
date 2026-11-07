// Spofy: deep import — the package entry is CommonJS and drags in every zod schema
import { APP_CONFIG_ROUTE_LEADING_PATH } from '@remnawave/subscription-page-types/build/backend/constants'
import { TSubscriptionPageRawConfig } from '@remnawave/subscription-page-types'
import { GetSubscriptionInfoByShortUuidCommand } from '@remnawave/backend-contract'
import { Outlet } from 'react-router'
import { useEffect, useLayoutEffect, useState } from 'react'
import consola from 'consola/browser'
import { ofetch } from 'ofetch'

import {
    useSubscriptionInfoStoreActions,
    useSubscriptionInfoStoreInfo
} from '@entities/subscription-info-store'
import { useAppConfigStoreActions, useIsConfigLoaded } from '@entities/app-config-store'
import { isUsableConfig, SpofyShell, useSpofyStore } from '../../../spofy'
import { SpofyFallback } from '../../../spofy/spofy-fallback'

/** How long the shield may stay before we admit the load failed. */
const STALLED_AFTER_MS = 8000

import classes from './root.module.css'

export function RootLayout() {
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
                    consola.log(error)
                } finally {
                    subPageDiv.remove()
                }
            }
        }

        const fetchConfig = async () => {
            try {
                const tempConfig = await ofetch<unknown>(
                    `${APP_CONFIG_ROUTE_LEADING_PATH}?v=${Date.now()}`,
                    {
                        parseResponse: (response) => JSON.parse(response)
                    }
                )

                // Spofy: the backend already validates this config with the same zod schema at
                // startup; skipping the client-side parse keeps zod (~70 KB gz) out of the bundle.
                if (!isUsableConfig(tempConfig)) {
                    consola.error('Failed to parse app config')
                    return
                }

                configActions.setConfig(tempConfig as TSubscriptionPageRawConfig)
            } catch (error) {
                consola.error('Failed to fetch app config:', error)
            }
        }

        fetchConfig()
    }, [])

    if (!isReady) {
        if (stalled) return <SpofyFallback kind="stalled" />
        return (
            <div className={classes.root}>
                <div className="animated-background"></div>
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
            <div className="animated-background"></div>
            <div className={classes.content}>
                <main className={classes.main}>
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
