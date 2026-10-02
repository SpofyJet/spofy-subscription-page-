import { useEffect, useMemo } from 'react'

import { useAppConfig, useCurrentLang } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { ActionsRow, BypassNotice, InactiveHero } from './components/actions'
import { ConnectSection } from './components/connect-section'
import { SpofyHeader } from './components/header'
import { LinkCard } from './components/link-card'
import { StatusCard } from './components/status-card'
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
    const trafficCta = hasTrafficLimit ? spofy.trafficUrl : null

    return (
        <div className={classes.page}>
            <SpofyHeader supportUrl={supportUrl} />

            {state === 'expired' || state === 'disabled' || state === 'limited' ? (
                <>
                    <InactiveHero
                        hasTrafficReset={
                            !!user.trafficLimitStrategy && user.trafficLimitStrategy !== 'NO_RESET'
                        }
                        renewUrl={spofy.renewUrl}
                        state={state}
                        supportUrl={supportUrl}
                        trafficUrl={trafficCta}
                    />
                    <StatusCard state={state} user={user} />
                </>
            ) : (
                <>
                    <StatusCard state={state} user={user} />
                    <ActionsRow renewUrl={spofy.renewUrl} trafficUrl={trafficCta} />
                </>
            )}

            {spofy.bypassDisabled && <BypassNotice trafficUrl={spofy.trafficUrl} />}

            <ConnectSection detected={detected} />

            <LinkCard supportUrl={supportUrl} />
        </div>
    )
}
