import clsx from 'clsx'

import {
    COUNTER_DAYS,
    EXPIRING_DAYS,
    formatBytes,
    formatDate,
    formatDays,
    isIndefinite,
    toNumber,
    TSpofyState,
    TSpofyUser
} from '../format'
import { TSpofyKey, useSpofyT } from '../i18n'
import classes from '../spofy.module.css'

const STATUS_LABEL: Record<TSpofyState, TSpofyKey> = {
    active: 'statusActive',
    expiring: 'statusExpiring',
    expired: 'statusExpired',
    disabled: 'statusDisabled',
    limited: 'statusLimited'
}

export function StatusCard({ state, user }: { state: TSpofyState; user: TSpofyUser }) {
    const { t, lang } = useSpofyT()

    const indefinite = isIndefinite(user.expiresAt)
    const isRunning = state === 'active' || state === 'expiring' || state === 'limited'
    const showCounter = isRunning && !indefinite && user.daysLeft <= COUNTER_DAYS
    const date = formatDate(user.expiresAt, lang)

    let validity: React.ReactNode
    if (indefinite) {
        validity = t('indefinite')
    } else if (state === 'expired') {
        validity = t('endedOn', { date })
    } else {
        validity = (
            <>
                {t('validUntil', { date })}
                {!showCounter && (
                    <>
                        {' · '}
                        <span className={clsx(classes.num, classes.validityStrong)}>
                            {t('daysLeftShort', { n: user.daysLeft })}
                        </span>
                    </>
                )}
            </>
        )
    }

    return (
        <section aria-label={t(STATUS_LABEL[state])} className={classes.card}>
            <div className={classes.statusTop}>
                <span className={classes.statusLabel}>
                    <span
                        aria-hidden
                        className={clsx(
                            classes.dot,
                            state === 'expiring' && classes.dotWarning,
                            (state === 'expired' || state === 'disabled' || state === 'limited') &&
                                classes.dotError
                        )}
                    />
                    {t(STATUS_LABEL[state])}
                </span>
                <span className={classes.username} title={user.username}>
                    {user.username}
                </span>
            </div>

            {showCounter && (
                <div className={classes.counter}>
                    <span
                        className={clsx(
                            classes.counterValue,
                            classes.num,
                            user.daysLeft <= EXPIRING_DAYS && classes.counterWarning
                        )}
                    >
                        {user.daysLeft > 0
                            ? `${user.daysLeft} ${formatDays(user.daysLeft, lang)}`
                            : t('lastDay')}
                    </span>
                    {user.daysLeft > 0 && (
                        <span className={classes.counterCaption}>{t('untilEnd')}</span>
                    )}
                </div>
            )}

            <p className={classes.validity}>{validity}</p>

            <hr className={classes.divider} />

            <Traffic user={user} />
        </section>
    )
}

function Traffic({ user }: { user: TSpofyUser }) {
    const { t, lang } = useSpofyT()

    const used = toNumber(user.trafficUsedBytes)
    const limit = toNumber(user.trafficLimitBytes)
    const usedText = formatBytes(used, lang)

    if (limit <= 0) {
        return (
            <div className={classes.trafficRow}>
                <span className={classes.trafficLabel}>{t('traffic')}</span>
                <span className={clsx(classes.trafficValue, classes.num)}>
                    {t('trafficUnlimited', { used: usedText })}
                </span>
            </div>
        )
    }

    const share = Math.min(1, used / limit)
    const usedPercent = Math.round(share * 100)
    const leftPercent = Math.max(0, 100 - usedPercent)
    const level = share >= 0.9 ? 'error' : share >= 0.5 ? 'warning' : 'ok'
    const resetKey =
        user.trafficLimitStrategy && user.trafficLimitStrategy !== 'NO_RESET'
            ? (`trafficReset${user.trafficLimitStrategy}` as TSpofyKey)
            : null

    return (
        <div>
            <div className={classes.trafficRow}>
                <span className={classes.trafficLabel}>{t('traffic')}</span>
                <span className={clsx(classes.trafficValue, classes.num)}>
                    {t('trafficOf', { used: usedText, limit: formatBytes(limit, lang) })}
                </span>
            </div>
            <div
                aria-label={t('traffic')}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={usedPercent}
                aria-valuetext={t('trafficLeft', { p: leftPercent })}
                className={classes.bar}
                role="progressbar"
            >
                <div
                    className={clsx(
                        classes.barFill,
                        level === 'warning' && classes.barWarning,
                        level === 'error' && classes.barError
                    )}
                    style={{ width: `${Math.max(usedPercent, used > 0 ? 2 : 0)}%` }}
                />
            </div>
            <div className={classes.trafficMeta}>
                <span
                    className={clsx(
                        classes.num,
                        level === 'warning' && classes.trafficLeftWarning,
                        level === 'error' && classes.trafficLeftError
                    )}
                >
                    {t('trafficLeft', { p: leftPercent })}
                </span>
                {resetKey && <span>{t(resetKey)}</span>}
            </div>
        </div>
    )
}
