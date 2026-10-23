import {
    IconAlertTriangle,
    IconArrowsUpDown,
    IconCalendarEvent,
    IconDevices,
    IconPlus,
    IconPlugConnected,
    IconRefresh,
    IconSparkles
} from '@tabler/icons-react'
import clsx from 'clsx'
import { useId, useState } from 'react'

import { useSubscription } from '@entities/subscription-info-store'

import { useCheckoutStore } from '../checkout/checkout-store'
import { useMoney } from '../checkout/money'
import {
    countOf,
    formatBytes,
    formatDayMonth,
    formatDays,
    formatTimeLeft,
    toNumber
} from '../format'
import { TSpofyKey, useSpofyT } from '../i18n'
import { CONNECT_ID, IAction, IPageModel, TView } from '../page-model'
import { revealBlock } from '../scroll'
import { useSpofyData } from '../spofy-store'
import classes from '../spofy.module.css'
import { StatusShield, TShieldTone } from './status-shield'
import { ActionButton, HintToggle } from './ui'

const TONE: Record<TView, TShieldTone> = {
    active: 'ok',
    expiring: 'warning',
    trial: 'trial',
    expired: 'error',
    disabled: 'muted',
    limited: 'error'
}

const scrollToGuide = () => revealBlock(document.getElementById(CONNECT_ID))

/**
 * The subscription at a glance, written for someone who does not know the word «подписка»:
 * the title says whether the VPN works, the rows say until when and how many devices / how
 * much traffic — each row with its own small button (Продлить · Добавить · Докупить) — and a
 * single main button appears only when the situation needs one.
 */
export function StatusCard({ model }: { model: IPageModel }) {
    const { user } = useSubscription()
    const spofy = useSpofyData()
    const { t, lang } = useSpofyT()
    const money = useMoney()
    const offer = useCheckoutStore((s) => s.offer)
    const { view } = model
    const tone = TONE[view]
    const [now] = useState(() => Date.now())

    const date = formatDayMonth(user.expiresAt, lang)
    const daysLeft = Math.max(0, user.daysLeft)
    const left = countOf(daysLeft, lang, 'day')
    const timeLeft = formatTimeLeft(user.expiresAt, lang) || t('lastDay')
    const live = view === 'active' || view === 'expiring'
    const fresh = model.noDevices && (view === 'active' || view === 'trial')

    /* ── title and the line under it: does it work, until when ── */
    let title: string
    let line: null | string
    switch (view) {
        case 'trial':
            title = t('stTrialTitle', { left: timeLeft })
            line = model.indefinite ? null : t('stTrialFreeUntil', { date })
            break
        case 'expiring':
            title = daysLeft === 0 ? t('stExpiringToday') : t('stExpiringIn', { left })
            line = t('stPaidTill', { date })
            break
        case 'expired':
            title = t('stExpired')
            line = model.trial ? t('stTrialEndedOn', { date }) : t('stExpiredOn', { date })
            break
        case 'disabled':
            title = t('stDisabled')
            line = t('stDisabledLine')
            break
        case 'limited':
            title = t('stLimited')
            line = t('stLimitedLine')
            break
        default:
            title = fresh ? t('stNoDevicesTitle') : t('stActive')
            line = model.indefinite ? t('stIndefinite') : null
    }

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

    /* ── a sentence for the situation ── */
    const resetText = resetSentence(user.trafficLimitStrategy, lang, t)
    const note: null | string =
        view === 'expired'
            ? model.trial
                ? t('stTrialEndedNote')
                : t('heroExpiredText')
            : view === 'disabled'
              ? t('heroDisabledText')
              : view === 'limited'
                ? `${model.indefinite ? t('buyTraffic') + '.' : t('stLimitedNote', { date })}${resetText}`
                : fresh
                  ? t('stNoDevicesNote')
                  : view === 'trial'
                    ? t('stTrialPitch')
                    : view === 'expiring'
                      ? t('stExpiringPitch')
                      : null

    const trafficFrom = model.trafficFrom
        ? t('ctaFrom', { price: money(model.trafficFrom.price_kopeks) })
        : null
    const deviceFrom = model.deviceFrom ? t('ctaFrom', { price: money(model.deviceFrom) }) : null
    // Without in-page checkout the buttons open the bot: say so, and show where they lead.
    const bot = (label: string) => (model.inPage ? label : `${label} ${t('inBot')}`)

    /* ── a sales moment: at most one callout, only while everything else is fine ── */
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
    const calloutIcon = {
        'aria-hidden': true,
        className: classes.calloutIcon,
        size: 20,
        stroke: 1.9
    }
    // Two days before the end only «Продлить» matters; before the first device, only connecting.
    if (view === 'active' && !fresh) {
        if (restore) {
            moment = {
                key: 'bypass',
                text: t('stBypassOff'),
                action: restore,
                label: bot(t('ctaRestore')),
                price: model.inPage ? trafficFrom : null,
                icon: <IconAlertTriangle {...calloutIcon} />
            }
        } else if (model.traffic && trafficShare >= 0.85 && trafficShare < 1) {
            moment = {
                key: 'traffic',
                text: `${t('stTrafficLow', { left: formatBytes(Math.max(0, trafficLimit - trafficUsed), lang) })}${resetText}`,
                action: model.traffic,
                label: bot(t('buyTraffic')),
                price: model.inPage ? trafficFrom : null,
                icon: <IconArrowsUpDown {...calloutIcon} />
            }
        } else if (model.devices && devicesFull) {
            moment = {
                key: 'devices',
                text:
                    devicesLimit === 1
                        ? t('stDeviceFullOne')
                        : t('stDevicesFull', { n: countOf(devicesLimit!, lang, 'device') }),
                action: model.devices,
                label: bot(t('ctaAddDevice')),
                price: model.inPage ? deviceFrom : null,
                icon: <IconDevices {...calloutIcon} />
            }
        }
    }

    /* ── the one main button, when the situation needs one ── */
    const external = !model.inPage
    const connect = (
        <ActionButton
            action={{ onClick: scrollToGuide }}
            icon={<IconPlugConnected aria-hidden size={19} stroke={2} />}
            label={t('ctaConnect')}
            variant="primary"
        />
    )
    let actions: React.ReactNode = null
    if (view === 'trial') {
        const plan = model.renew && (
            <ActionButton
                action={model.renew}
                external={external}
                icon={<IconSparkles aria-hidden size={19} stroke={2} />}
                label={bot(t('ctaChoosePlan'))}
                variant={fresh ? 'secondary' : 'primary'}
            />
        )
        actions = fresh ? (
            <>
                {connect}
                {plan}
            </>
        ) : (
            plan
        )
    } else if (fresh) {
        actions = connect
    } else if ((view === 'expired' || view === 'disabled' || view === 'expiring') && model.renew) {
        actions = (
            <ActionButton
                action={model.renew}
                external={external}
                icon={<IconRefresh aria-hidden size={19} stroke={2.1} />}
                label={bot(
                    model.trial && view === 'expired' ? t('ctaChoosePlan') : t('ctaRenew')
                )}
                variant="primary"
            />
        )
    } else if (view === 'limited' && model.traffic) {
        actions = (
            <ActionButton
                action={model.traffic}
                external={external}
                icon={<IconPlus aria-hidden size={19} stroke={2.2} />}
                label={bot(t('buyTraffic'))}
                price={model.inPage ? trafficFrom : null}
                variant="primary"
            />
        )
    }

    /* ── rows: until when · devices · traffic, each with its own button ── */
    const showRows = view !== 'expired' && view !== 'disabled'
    // the main button above already does it — no second button for the same thing
    const quiet = view === 'expiring' || fresh
    const renewRow = view !== 'trial' && !model.indefinite && !quiet ? model.renew : null

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
                        {title}
                    </h1>
                    {line && (
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
                            external={external}
                            icon={<IconPlus aria-hidden size={17} stroke={2.2} />}
                            label={moment.label}
                            price={moment.price}
                            variant="solid"
                        />
                    </div>
                </div>
            )}

            {showRows && (
                <ul className={classes.rows}>
                    {view !== 'trial' && !model.indefinite && (
                        <StatRow
                            action={renewRow}
                            actionIcon={<IconRefresh aria-hidden size={17} stroke={2.2} />}
                            actionLabel={t('renewShort')}
                            external={external}
                            icon={<IconCalendarEvent size={18} stroke={1.9} />}
                            label={t('rowPaidTill')}
                            tone={view === 'expiring' ? 'warning' : undefined}
                            value={
                                <>
                                    {date}
                                    <span className={classes.rowValueSub}>
                                        {daysLeft === 0
                                            ? t('lastDay')
                                            : t('daysLeftLine', {
                                                  n: daysLeft,
                                                  days: formatDays(daysLeft, lang)
                                              })}
                                    </span>
                                </>
                            }
                        />
                    )}
                    {(spofy.devicesUsed !== null || devicesLimit !== null) && (
                        <StatRow
                            action={
                                live && !quiet && moment?.key !== 'devices' ? model.devices : null
                            }
                            actionLabel={t('rowAdd')}
                            external={external}
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
                            live && !quiet && moment?.key !== 'traffic' && moment?.key !== 'bypass'
                                ? model.traffic
                                : null
                        }
                        external={external}
                        limited={view === 'limited'}
                    />
                </ul>
            )}

            {!model.inPage && showRows && (model.renew || model.devices || model.traffic) && (
                <p className={classes.statusNote}>{t('stInBotNote')}</p>
            )}

            {actions && <div className={classes.statusActions}>{actions}</div>}
        </section>
    )
}

/** «Лимит обновится 1 ноября.» for a monthly reset; the strategy's own sentence otherwise. */
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
    actionIcon?: React.ReactNode
    actionLabel: string
    bar?: React.ReactNode
    external?: boolean
    /** a «?» with this explanation; rows that need none have none */
    hint?: string
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
                        {props.hint && (
                            <HintToggle
                                controls={hintId}
                                onToggle={() => setOpen((v) => !v)}
                                open={open}
                            />
                        )}
                    </span>
                    <span className={clsx(classes.rowValue, classes.num)}>{props.value}</span>
                </span>
                {props.action && (
                    <ActionButton
                        action={props.action}
                        className={classes.rowAction}
                        external={props.external}
                        icon={props.actionIcon ?? <IconPlus aria-hidden size={17} stroke={2.4} />}
                        label={props.actionLabel}
                        variant="ghost"
                    />
                )}
            </div>
            {props.bar}
            {props.hint && (
                <p className={classes.rowHint} hidden={!open} id={hintId}>
                    {props.hint}
                </p>
            )}
        </li>
    )
}

function TrafficRow({
    action,
    external,
    limited
}: {
    action: IAction | null
    external: boolean
    /** the panel stopped the whole VPN: this is all traffic, not just «Обход» */
    limited: boolean
}) {
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

    const share = Math.min(1, used / limit)
    const level = share >= 0.9 ? 'error' : share >= 0.7 ? 'warning' : undefined
    const percentLeft = Math.max(0, Math.round((1 - share) * 100))
    const [num, unit] = formatBytes(used, lang).split(' ')
    const label = limited ? t('traffic') : t('rowTraffic')

    return (
        <StatRow
            action={action}
            actionLabel={t('rowBuy')}
            bar={
                <span
                    aria-label={label}
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
            external={external}
            hint={limited ? undefined : hint}
            icon={<IconArrowsUpDown size={18} stroke={1.9} />}
            label={label}
            tone={level}
            value={
                unit && formatBytes(limit, lang).endsWith(unit)
                    ? t('rowOf', { used: num!, limit: formatBytes(limit, lang) })
                    : t('rowOf', { used: formatBytes(used, lang), limit: formatBytes(limit, lang) })
            }
        />
    )
}
