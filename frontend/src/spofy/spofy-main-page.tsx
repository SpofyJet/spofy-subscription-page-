import { useEffect, useMemo } from 'react'

import { useAppConfig, useCurrentLang } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { BypassNotice } from './components/actions'
import { SubscriptionBanner, TopBar } from './components/banner'
import { ConnectSection } from './components/connect-section'
import { LinkCard } from './components/link-card'
import { detectPlatform, getSubscriptionState, toNumber } from './format'
import { useSpofyData } from './spofy-store'
import classes from './spofy.module.css'

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
                    renewUrl={spofy.renewUrl}
                    state={state}
                    supportUrl={supportUrl}
                    trafficUrl={hasTrafficLimit ? spofy.trafficUrl : null}
                    user={user}
                />

                {spofy.bypassDisabled && <BypassNotice trafficUrl={spofy.trafficUrl} />}

                <ConnectSection detected={detected} />

                <LinkCard cabinetUrl={spofy.cabinetUrl} />
            </div>
        </>
    )
}
