import {
    IconAlertTriangle,
    IconArrowsUpDown,
    IconDevices,
    IconMessageCircle,
    IconPlus,
    IconRefresh,
    IconSparkles
} from '@tabler/icons-react'
import clsx from 'clsx'
import { useId, useState } from 'react'

import { useSubscription } from '@entities/subscription-info-store'

import { useCheckoutStore } from '../checkout/checkout-store'
import { useMoney } from '../checkout/money'
import { countOf, formatBytes, formatDayMonth, formatTimeLeft, toNumber } from '../format'
import { TSpofyKey, useSpofyT } from '../i18n'
import { IAction, IPageModel, TView } from '../page-model'
import { useSpofyData } from '../spofy-store'
import classes from '../spofy.module.css'
import { StatusShield, TShieldTone } from './status-shield'
import { ActionButton, HintToggle } from './ui'

const TITLE: Record<TView, TSpofyKey> = {
    active: 'stActive',
    expiring: 'stExpiring',
    trial: 'stTrial',
    expired: 'stExpired',
    disabled: 'stDisabled',
    limited: 'stLimited'
}

const TONE: Record<TView, TShieldTone> = {
    active: 'ok',
    expiring: 'warning',
    trial: 'trial',
    expired: 'error',
    disabled: 'muted',
    limited: 'error'
}

/**
 * The subscription at a glance. One card, one main action, wording for the person's situation:
 * the shield shows how much is left, the rows show devices and traffic with their own small
 * «add» buttons, and nothing is offered that cannot help right now.
 */
export function StatusCard({
    model,
    supportUrl
}: {
    model: IPageModel
    supportUrl: null | string
}) {
    const { user } = useSubscription()
    const spofy = useSpofyData()
    const { t, lang } = useSpofyT()
    const money = useMoney()
    const offer = useCheckoutStore((s) => s.offer)
    const { view } = model
    const tone = TONE[view]
    const [now] = useState(() => Date.now())

    /* ── headline ── */
    const date = formatDayMonth(user.expiresAt, lang)
    const daysLeft = Math.max(0, user.daysLeft)
    let line: string
    if (view === 'expired' || view === 'disabled') line = t('stExpiredOn', { date })
    else if (model.indefinite) line = t('stIndefinite')
    else if (view === 'trial')
        line = t('stTrialLeft', { left: formatTimeLeft(user.expiresAt, lang) || t('lastDay') })
    else if (daysLeft === 0) line = t('stEndsToday', { date })
    else line = t('stLeftUntil', { left: countOf(daysLeft, lang, 'day'), date })
    if (view === 'limited') line = model.indefinite ? t('stIndefinite') : t('stSubUntil', { date })

    // Shield «charge»: share of a month left (a trial counts against three days).
    const hoursLeft = Math.max(0, (new Date(user.expiresAt).getTime() - now) / 3_600_000)
    const level =
        view === 'expired' || view === 'disabled' || view === 'limited'
            ? 0
            : model.indefinite
              ? 1
              : view === 'trial'
                ? Math.max(0.1, Math.min(1, hoursLeft / 72))
                : Math.max(0.08, Math.min(1, daysLeft / 30))

    /* ── note under the headline ── */
    const hasReset = !!user.trafficLimitStrategy && user.trafficLimitStrategy !== 'NO_RESET'
    const note: null | string =
        view === 'expired'
            ? model.trial
                ? t('stTrialEndedNote')
                : t('heroExpiredText')
            : view === 'disabled'
              ? t('heroDisabledText')
              : view === 'limited'
                ? hasReset
                    ? t('heroLimitedResetText')
                    : t('heroLimitedText')
                : view === 'trial'
                  ? t('stTrialPitch')
                  : view === 'expiring'
                    ? t('stExpiringPitch')
                    : null

    /* ── prices for the buttons ── */
    const from =
        model.renewFrom !== null ? t('ctaFromMonth', { price: money(model.renewFrom) }) : null
    const trafficFrom = model.trafficFrom
        ? t('ctaFrom', { price: money(model.trafficFrom.price_kopeks) })
        : null
    const deviceFrom = model.deviceFrom ? t('ctaFrom', { price: money(model.deviceFrom) }) : null
    const renewIcon = <IconRefresh aria-hidden size={19} stroke={2.1} />

    /* ── a sales moment: at most one callout, only while the VPN works ── */
    const live = view === 'active' || view === 'expiring'
    const devicesLimit = spofy.devicesLimit ?? offer?.devices.current_device_limit ?? null
    const devicesFull =
        spofy.devicesUsed !== null && devicesLimit !== null && spofy.devicesUsed >= devicesLimit
    const trafficLimit = toNumber(user.trafficLimitBytes)
    const trafficUsed = toNumber(user.trafficUsedBytes)
    const trafficShare = trafficLimit > 0 ? trafficUsed / trafficLimit : 0
    const restore: IAction | null = model.bypassOff
        ? (model.traffic ?? (spofy.trafficUrl ? { href: spofy.trafficUrl } : null))
        : null

    let moment: null | {
        action: IAction
        icon: React.ReactNode
        key: 'bypass' | 'devices' | 'traffic'
        label: string
        price: null | string
        text: string
    } = null
    if (live && restore) {
        moment = {
            key: 'bypass',
            text: t('stBypassOff'),
            action: restore,
            label: t('ctaRestore'),
            price: trafficFrom,
            icon: (
                <IconAlertTriangle
                    aria-hidden
                    className={classes.calloutIcon}
                    size={20}
                    stroke={1.9}
                />
            )
        }
    } else if (live && model.traffic && trafficShare >= 0.85 && trafficShare < 1) {
        const left = formatBytes(Math.max(0, trafficLimit - trafficUsed), lang)
        moment = {
            key: 'traffic',
            text: `${t('stTrafficLow', { left })}${resetSentence(user.trafficLimitStrategy, lang, t)}`,
            action: model.traffic,
            label: t('buyTraffic'),
            price: trafficFrom,
            icon: (
                <IconArrowsUpDown
                    aria-hidden
                    className={classes.calloutIcon}
                    size={20}
                    stroke={1.9}
                />
            )
        }
    } else if (live && model.devices && devicesFull) {
        moment = {
            key: 'devices',
            text:
                devicesLimit === 1
                    ? t('stDeviceFullOne')
                    : t('stDevicesFull', { n: countOf(devicesLimit!, lang, 'device') }),
            action: model.devices,
            label: t('ctaAddDevice'),
            price: deviceFrom,
            icon: <IconDevices aria-hidden className={classes.calloutIcon} size={20} stroke={1.9} />
        }
    }

    /* ── the one main action for the situation ── */
    let actions: React.ReactNode = null
    if (view === 'trial' && model.renew) {
        actions = (
            <ActionButton
                action={model.renew}
                icon={<IconSparkles aria-hidden size={19} stroke={2} />}
                label={t('ctaChoosePlan')}
                price={from}
                variant="primary"
            />
        )
    } else if ((view === 'expired' || view === 'disabled') && model.renew) {
        actions = (
            <>
                <ActionButton
                    action={model.renew}
                    icon={renewIcon}
                    label={model.trial ? t('ctaChoosePlan') : t('ctaRenew')}
                    price={from}
                    variant="primary"
                />
                {view === 'disabled' && supportUrl && (
                    <ActionButton
                        action={{ href: supportUrl }}
                        icon={<IconMessageCircle aria-hidden size={19} stroke={2} />}
                        label={t('writeSupport')}
                        variant="secondary"
                    />
                )}
            </>
        )
    } else if (view === 'limited') {
        actions = (
            <>
                {model.traffic && (
                    <ActionButton
                        action={model.traffic}
                        icon={<IconPlus aria-hidden size={19} stroke={2.2} />}
                        label={t('buyTraffic')}
                        price={trafficFrom}
                        variant="primary"
                    />
                )}
                {model.renew && !model.indefinite && (
                    <ActionButton
                        action={model.renew}
                        icon={renewIcon}
                        label={t('ctaRenew')}
                        price={from}
                        variant={model.traffic ? 'ghost' : 'primary'}
                    />
                )}
            </>
        )
    } else if (view === 'expiring' && model.renew && !model.indefinite) {
        actions = (
            <ActionButton
                action={model.renew}
                icon={renewIcon}
                label={t('ctaRenew')}
                price={from}
                variant="primary"
            />
        )
    } else if (model.renew && !model.indefinite) {
        // Connected and far from the end: no shop window — renewing early is a quiet link.
        actions = (
            <ActionButton
                action={model.renew}
                icon={renewIcon}
                label={t('ctaRenewEarly')}
                price={from}
                variant="ghost"
            />
        )
    }

    /* ── rows: devices and traffic (not for a subscription that has ended) ── */
    const showRows = view !== 'expired' && view !== 'disabled'
    const quietRows = view === 'limited'

    return (
        <section
            aria-labelledby="sp-status"
            className={clsx(classes.card, classes.status)}
            data-tone={tone}
        >
            <div className={classes.statusHead}>
                <StatusShield level={level} tone={tone} />
                <div className={classes.statusText}>
                    {view === 'trial' && <span className={classes.trialBadge}>{t('stTrial')}</span>}
                    <h1 className={classes.statusTitle} id="sp-status">
                        {view === 'trial'
                            ? t('stTrialTitle', {
                                  left: formatTimeLeft(user.expiresAt, lang) || t('lastDay')
                              })
                            : view === 'expired' && model.trial
                              ? t('stTrialEnded')
                              : t(TITLE[view])}
                    </h1>
                    {view !== 'trial' && (
                        <p
                            className={clsx(
                                classes.statusLine,
                                classes.num,
                                (view === 'limited' || view === 'active') && classes.statusLineQuiet
                            )}
                        >
                            {line}
                        </p>
                    )}
                    {view === 'trial' && !model.indefinite && (
                        <p className={clsx(classes.statusLine, classes.num)}>
                            {t('untilDate', { date })}
                        </p>
                    )}
                </div>
            </div>

            {note && <p className={classes.statusNote}>{note}</p>}

            {moment && (
                <div className={classes.callout} role="status">
                    {moment.icon}
                    <div className={classes.calloutBody}>
                        <p>{moment.text}</p>
                        <ActionButton
                            action={moment.action}
                            className={classes.btnSmall}
                            icon={<IconPlus aria-hidden size={17} stroke={2.2} />}
                            label={moment.label}
                            price={moment.price}
                            variant={view === 'expiring' ? 'soft' : 'solid'}
                        />
                    </div>
                </div>
            )}

            {showRows && (
                <ul className={classes.rows}>
                    {(spofy.devicesUsed !== null || devicesLimit !== null) && (
                        <StatRow
                            action={quietRows || moment?.key === 'devices' ? null : model.devices}
                            actionLabel={t('rowAdd')}
                            hint={t('hintDevices')}
                            icon={<IconDevices size={18} stroke={1.9} />}
                            label={t('rowDevices')}
                            tone={devicesFull ? 'warning' : undefined}
                            value={
                                spofy.devicesUsed !== null
                                    ? t('rowOf', {
                                          used: spofy.devicesUsed,
                                          limit: devicesLimit ?? '∞'
                                      })
                                    : String(devicesLimit)
                            }
                        />
                    )}
                    <TrafficRow
                        action={
                            quietRows || moment?.key === 'traffic' || moment?.key === 'bypass'
                                ? null
                                : model.traffic
                        }
                    />
                </ul>
            )}

            {actions && <div className={classes.statusActions}>{actions}</div>}
        </section>
    )
}

/** «Он обновится 1 ноября.» for a monthly reset; the strategy's own sentence otherwise. */
function resetSentence(
    strategy: string | undefined,
    lang: Parameters<typeof formatDayMonth>[1],
    t: (key: TSpofyKey, vars?: Record<string, number | string>) => string
): string {
    if (!strategy || strategy === 'NO_RESET') return ''
    if (strategy === 'MONTH') {
        const now = new Date()
        return ` ${t('stTrafficResets', { date: formatDayMonth(new Date(now.getFullYear(), now.getMonth() + 1, 1), lang) })}`
    }
    return ` ${t(`trafficReset${strategy}` as TSpofyKey)}.`
}

function StatRow(props: {
    action: IAction | null
    actionLabel: string
    bar?: React.ReactNode
    hint: string
    icon: React.ReactNode
    label: string
    tone?: 'error' | 'warning'
    value: React.ReactNode
}) {
    const [open, setOpen] = useState(false)
    const hintId = useId()
    return (
        <li className={classes.row} data-tone={props.tone}>
            <div className={classes.rowMain}>
                <span aria-hidden className={classes.rowIcon}>
                    {props.icon}
                </span>
                <span className={classes.rowText}>
                    <span className={classes.rowLabel}>
                        {props.label}
                        <HintToggle
                            controls={hintId}
                            onToggle={() => setOpen((v) => !v)}
                            open={open}
                        />
                    </span>
                    <span className={clsx(classes.rowValue, classes.num)}>{props.value}</span>
                </span>
                {props.action && (
                    <ActionButton
                        action={props.action}
                        className={classes.rowAction}
                        icon={<IconPlus aria-hidden size={15} stroke={2.4} />}
                        label={props.actionLabel}
                        variant="ghost"
                    />
                )}
            </div>
            {props.bar}
            <p className={classes.rowHint} hidden={!open} id={hintId}>
                {props.hint}
            </p>
        </li>
    )
}

function TrafficRow({ action }: { action: IAction | null }) {
    const { user } = useSubscription()
    const { t, lang } = useSpofyT()
    const used = toNumber(user.trafficUsedBytes)
    const limit = toNumber(user.trafficLimitBytes)
    const hasReset = !!user.trafficLimitStrategy && user.trafficLimitStrategy !== 'NO_RESET'
    const resetKey = `trafficReset${user.trafficLimitStrategy}` as TSpofyKey
    const hint = hasReset ? `${t('hintTraffic')} ${t(resetKey)}.` : t('hintTraffic')

    if (limit <= 0) {
        return (
            <StatRow
                action={null}
                actionLabel=""
                hint={t('hintTrafficUnlimited')}
                icon={<IconArrowsUpDown size={18} stroke={1.9} />}
                label={t('traffic')}
                value={
                    <>
                        {t('rowUnlimited')}
                        <span className={classes.rowValueSub}>
                            {t('rowUsed', { used: formatBytes(used, lang) })}
                        </span>
                    </>
                }
            />
        )
    }

    const total = limit
    const share = Math.min(1, used / total)
    const level = share >= 0.9 ? 'error' : share >= 0.7 ? 'warning' : undefined
    const percentLeft = Math.max(0, Math.round((1 - share) * 100))
    const [num, unit] = formatBytes(used, lang).split(' ')

    return (
        <StatRow
            action={action}
            actionLabel={t('rowBuy')}
            bar={
                <span
                    aria-label={t('rowTraffic')}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={Math.round(share * 100)}
                    aria-valuetext={t('trafficLeft', { p: percentLeft })}
                    className={classes.bar}
                    data-tone={level}
                    role="progressbar"
                >
                    <span style={{ width: `${Math.max(share * 100, used > 0 ? 2 : 0)}%` }} />
                </span>
            }
            hint={hint}
            icon={<IconArrowsUpDown size={18} stroke={1.9} />}
            label={t('rowTraffic')}
            tone={level}
            value={
                unit && formatBytes(total, lang).endsWith(unit)
                    ? t('rowOf', { used: num!, limit: formatBytes(total, lang) })
                    : t('rowOf', { used: formatBytes(used, lang), limit: formatBytes(total, lang) })
            }
        />
    )
}
