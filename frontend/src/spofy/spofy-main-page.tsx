import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

import { useAppConfig, useCurrentLang } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { track } from './checkout/api'
import { useCheckoutStore } from './checkout/checkout-store'
import { PendingBanner, usePendingPhase } from './checkout/pending'
import { BypassNotice } from './components/actions'
import { SubscriptionBanner, TopBar } from './components/banner'
import { ConnectSection } from './components/connect-section'
import { LinkCard } from './components/link-card'
import { detectPlatform, getSubscriptionState, toNumber } from './format'
import { useSpofyData } from './spofy-store'
import classes from './spofy.module.css'

// The purchase sheet (Drawer/Modal, forms, payment step) is not needed for the first paint.
const loadSheet = () => import('./components/checkout-sheet')
const CheckoutSheet = lazy(loadSheet)

export function SpofyMainPage() {
    const config = useAppConfig()
    const subscription = useSubscription()
    const spofy = useSpofyData()
    const lang = useCurrentLang()

    useEffect(() => {
        document.documentElement.lang = lang
    }, [lang])

    const detected = useMemo(
        () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0),
        []
    )

    const { user } = subscription
    const state = getSubscriptionState(user)
    const supportUrl = spofy.supportUrl ?? (config.brandingSettings.supportUrl || null)
    const hasTrafficLimit = toNumber(user.trafficLimitBytes) > 0
    const checkout = spofy.checkoutEnabled
    const phase = usePendingPhase()
    useEffect(() => {
        // one «page seen» per load; the server also counts it by platform
        if (checkout) track(user.shortUuid, 'view')
    }, [checkout, user.shortUuid])
    const opened = useCheckoutStore((s) => s.opened)
    const offerReady = useCheckoutStore((s) => !!s.offer)
    const [sheetMounted, setSheetMounted] = useState(false)
    useEffect(() => {
        if (opened) setSheetMounted(true)
    }, [opened])
    // Fetch the sheet's code once prices are in, while the person is still reading.
    useEffect(() => {
        if (!checkout || !offerReady) return
        const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300))
        idle(() => void loadSheet())
    }, [checkout, offerReady])

    return (
        <>
            <div aria-hidden className={classes.backdrop}>
                <div className={classes.backdropAurora} />
                <div className={classes.backdropGrid} />
            </div>
            <div className={classes.page}>
                <TopBar
                    displayName={spofy.displayName}
                    state={state}
                    supportUrl={supportUrl}
                    user={user}
                />

                <SubscriptionBanner
                    checkout={checkout}
                    renewUrl={spofy.renewUrl}
                    state={state}
                    supportUrl={supportUrl}
                    trafficUrl={hasTrafficLimit ? spofy.trafficUrl : null}
                    user={user}
                />

                {checkout && <PendingBanner phase={phase} />}

                {spofy.bypassDisabled && <BypassNotice trafficUrl={spofy.trafficUrl} />}

                <ConnectSection detected={detected} />

                <LinkCard cabinetUrl={spofy.cabinetUrl} />

                {checkout && sheetMounted && (
                    <Suspense fallback={null}>
                        <CheckoutSheet phase={phase} renewUrl={spofy.renewUrl} />
                    </Suspense>
                )}
            </div>
        </>
    )
}
