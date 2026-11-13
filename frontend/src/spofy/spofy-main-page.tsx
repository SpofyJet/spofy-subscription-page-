import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

import { whenIdle } from '@shared/utils/when-idle'

import { useAppConfig, useCurrentLang } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { track, trackOnce } from './checkout/api'
import { useCheckoutStore } from './checkout/checkout-store'
import { PendingBanner, usePendingPhase } from './checkout/pending'
import { cameBackFromPayment } from './checkout/return'
import { ConnectSection } from './components/connect-section'
import { Header } from './components/header'
import { MoreCard, SupportButton } from './components/more-card'
import { StatusCard } from './components/status-card'
import { detectPlatform } from './format'
import { usePageModel } from './page-model'
import { SpofyShell } from './spofy-shell'
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
    // Sent back here by the provider's «return» (see checkout/return.ts): show the invoice's
    // status at once — the window the person left, «Оплачено» as soon as the money is in.
    useEffect(() => {
        if (!checkout || !cameBackFromPayment()) return
        const { pending, openPayment, setAutoOpenedPaymentId } = useCheckoutStore.getState()
        if (!pending || pending.shortUuid !== user.shortUuid) return
        trackOnce(user.shortUuid, 'pay_return', pending.result.payment_id)
        // the payment page has been visited: «Перейти к оплате» stays, but quietly
        setAutoOpenedPaymentId(pending.result.payment_id)
        openPayment()
    }, [checkout, user.shortUuid])
    const opened = useCheckoutStore((s) => s.opened)
    const setPending = useCheckoutStore((s) => s.setPending)
    // Paid and applied while the window is closed: refresh, so the card above never says
    // «VPN выключен · Продлить» next to «Оплачено».
    useEffect(() => {
        if (phase !== 'done' || opened) return
        const id = window.setTimeout(() => {
            setPending(null)
            window.location.reload()
        }, 2_500)
        return () => window.clearTimeout(id)
    }, [phase, opened, setPending])
    const offerReady = useCheckoutStore((s) => !!s.offer)
    const [sheetMounted, setSheetMounted] = useState(false)
    useEffect(() => {
        if (!opened) return
        const id = window.setTimeout(() => setSheetMounted(true), 0)
        return () => window.clearTimeout(id)
    }, [opened])
    // Fetch the sheet's code once prices are in, while the person is still reading.
    useEffect(() => {
        if (!checkout || !offerReady) return
        whenIdle(() => void loadSheet().catch(() => undefined))
    }, [checkout, offerReady])

    // First paint waits for the bot's answer (tariff name, trial flag, prices) — otherwise the
    // card is drawn from the panel alone and then rewritten a moment later («бессрочная» →
    // «тариф ULTIMA», «VPN работает» → «Пробный период»). The bot is slow or down: show what
    // the panel knows after a short wait rather than a blank page.
    const settled = useCheckoutStore((s) => !!s.offer || !!s.offerError)
    const [patient, setPatient] = useState(true)
    useEffect(() => {
        if (!checkout || settled) return
        const id = window.setTimeout(() => setPatient(false), 2_500)
        return () => window.clearTimeout(id)
    }, [checkout, settled])

    const ended = model.view === 'expired' || model.view === 'disabled'
    // A device is already connected: the guide waits behind one row («ещё одно устройство»).
    // A newcomer (0 devices, or the panel does not count them) gets it open.
    const connected = (spofy.devicesUsed ?? 0) > 0
    const full =
        spofy.devicesUsed !== null &&
        spofy.devicesLimit !== null &&
        spofy.devicesUsed >= spofy.devicesLimit

    if (checkout && !settled && patient) return <SpofyShell />

    return (
        <>
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

                <MoreCard
                    cabinetUrl={spofy.cabinetUrl}
                    guideHasCopy={!ended && !full && !connected}
                />

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
