import { IconAlertTriangle, IconRefresh, IconPlus } from '@tabler/icons-react'
import clsx from 'clsx'

import { TSpofyState } from '../format'
import { useSpofyT } from '../i18n'
import classes from '../spofy.module.css'

interface IActionLinks {
    renewUrl: null | string
    /** null when the tariff has no traffic limit or no URL is configured */
    trafficUrl: null | string
}

function ActionButton(props: {
    href: string
    icon: React.ReactNode
    label: string
    primary?: boolean
}) {
    return (
        <a
            className={clsx(classes.btn, props.primary ? classes.btnPrimary : classes.btnSecondary)}
            href={props.href}
            rel="noopener noreferrer"
            target="_blank"
        >
            {props.icon}
            {props.label}
        </a>
    )
}

export function ActionsRow({ renewUrl, trafficUrl }: IActionLinks) {
    const { t } = useSpofyT()
    if (!renewUrl && !trafficUrl) return null

    return (
        <div className={classes.btnRow}>
            {renewUrl && (
                <ActionButton
                    href={renewUrl}
                    icon={<IconRefresh aria-hidden size={20} stroke={2} />}
                    label={t('renew')}
                    primary
                />
            )}
            {trafficUrl && (
                <ActionButton
                    href={trafficUrl}
                    icon={<IconPlus aria-hidden size={20} stroke={2} />}
                    label={t('buyTraffic')}
                />
            )}
        </div>
    )
}

export function InactiveHero(
    props: IActionLinks & {
        hasTrafficReset: boolean
        state: Extract<TSpofyState, 'disabled' | 'expired' | 'limited'>
        supportUrl: null | string
    }
) {
    const { state, renewUrl, trafficUrl, supportUrl, hasTrafficReset } = props
    const { t } = useSpofyT()

    const copy = {
        expired: { title: t('heroExpiredTitle'), text: t('heroExpiredText') },
        disabled: { title: t('heroDisabledTitle'), text: t('heroDisabledText') },
        limited: {
            title: t('heroLimitedTitle'),
            text: hasTrafficReset ? t('heroLimitedResetText') : t('heroLimitedText')
        }
    }[state]

    const renew = renewUrl && (
        <ActionButton
            href={renewUrl}
            icon={<IconRefresh aria-hidden size={20} stroke={2} />}
            key="renew"
            label={t('renew')}
            primary={state !== 'limited' || !trafficUrl}
        />
    )
    const traffic = trafficUrl && (
        <ActionButton
            href={trafficUrl}
            icon={<IconPlus aria-hidden size={20} stroke={2} />}
            key="traffic"
            label={t('buyTraffic')}
            primary={state === 'limited'}
        />
    )

    return (
        <section aria-labelledby="sp-hero-title" className={clsx(classes.card, classes.hero)}>
            <h2 className={classes.heroTitle} id="sp-hero-title">
                {copy.title}
            </h2>
            <p className={classes.heroText}>{copy.text}</p>
            <div className={classes.btnRow}>
                {state === 'limited' ? [traffic, renew] : [renew, traffic]}
                {state === 'disabled' && supportUrl && (
                    <a
                        className={clsx(classes.btn, classes.btnSecondary)}
                        href={supportUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        {t('writeSupport')}
                    </a>
                )}
            </div>
        </section>
    )
}

export function BypassNotice({ trafficUrl }: { trafficUrl: null | string }) {
    const { t } = useSpofyT()

    return (
        <section className={classes.notice} role="status">
            <IconAlertTriangle aria-hidden className={classes.noticeIcon} size={22} stroke={1.75} />
            <div className={classes.noticeBody}>
                <p className={classes.noticeText}>{t('bypassText')}</p>
                {trafficUrl && (
                    <a
                        className={clsx(classes.btn, classes.btnSecondary, classes.btnSmall)}
                        href={trafficUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        <IconPlus aria-hidden size={18} stroke={2} />
                        {t('buyTraffic')}
                    </a>
                )}
            </div>
        </section>
    )
}
