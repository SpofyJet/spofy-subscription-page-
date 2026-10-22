import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

import { useAppConfig, useCurrentLang } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { track } from './checkout/api'
import { useCheckoutStore } from './checkout/checkout-store'
import { PendingBanner, usePendingPhase } from './checkout/pending'
import { ConnectSection } from './components/connect-section'
import { Header } from './components/header'
import { MoreCard, SupportButton } from './components/more-card'
import { StatusCard } from './components/status-card'
import { detectPlatform } from './format'
import { usePageModel } from './page-model'
import { useSpofyData } from './spofy-store'
import classes from './spofy.module.css'

// The purchase sheet (Drawer/Modal, forms, payment step) is not needed for the first paint.
const loadSheet = () => import('./components/checkout-sheet')
const CheckoutSheet = lazy(loadSheet)

/**
 * Page order follows what the person came for:
 *   1. Is my VPN on? — the status card, with one main action for the situation.
 *   2. How do I connect? — the open, step-by-step guide.
 *   3. Everything else — another device, the link, the cabinet; support once, at the very bottom.
 */
export function SpofyMainPage() {
    const config = useAppConfig()
    const subscription = useSubscription()
    const spofy = useSpofyData()
    const lang = useCurrentLang()
    const model = usePageModel()

    useEffect(() => {
        document.documentElement.lang = lang
    }, [lang])

    const detected = useMemo(
        () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0),
        []
    )

    const { user } = subscription
    const supportUrl = spofy.supportUrl ?? (config.brandingSettings.supportUrl || null)
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

    const ended = model.view === 'expired' || model.view === 'disabled'
    // A device is already connected: the guide waits behind one row («ещё одно устройство»).
    // A newcomer (0 devices, or the panel does not count them) gets it open.
    const connected = (spofy.devicesUsed ?? 0) > 0
    const full =
        spofy.devicesUsed !== null &&
        spofy.devicesLimit !== null &&
        spofy.devicesUsed >= spofy.devicesLimit

    return (
        <>
            <div aria-hidden className={classes.backdrop} data-view={model.view}>
                <div className={classes.backdropAurora} />
            </div>
            <div className={classes.page}>
                {/* the Telegram nickname from the panel's user description, never the technical id */}
                <Header account={spofy.displayName} />

                <StatusCard model={model} />

                {checkout && <PendingBanner phase={phase} />}

                <ConnectSection
                    collapsed={ended ? 'ended' : full ? 'full' : connected ? 'connected' : null}
                    detected={detected}
                    key={ended ? 'ended' : full ? 'full' : connected ? 'connected' : 'open'}
                />

                <MoreCard cabinetUrl={spofy.cabinetUrl} />

                <SupportButton supportUrl={supportUrl} />

                {checkout && sheetMounted && (
                    <Suspense fallback={null}>
                        <CheckoutSheet
                            phase={phase}
                            renewUrl={spofy.renewUrl}
                            supportUrl={supportUrl}
                        />
                    </Suspense>
                )}
            </div>
        </>
    )
}
