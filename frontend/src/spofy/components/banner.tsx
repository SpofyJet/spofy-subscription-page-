import { Menu } from '@mantine/core'
import { TSubscriptionPageLanguageCode } from '@remnawave/subscription-page-types'
// deep import: the package entry is CommonJS and pulls in every zod schema
import { getLanguageInfo } from '@remnawave/subscription-page-types/build/backend/constants'
import {
    IconAlertCircle,
    IconBrandTelegram,
    IconChevronDown,
    IconMessageCircle,
    IconPlus,
    IconRefresh
} from '@tabler/icons-react'
import clsx from 'clsx'

import { useAppConfig, useAppConfigStoreActions, useCurrentLang } from '@entities/app-config-store'

import {
    EXPIRING_DAYS,
    formatBytes,
    formatDate,
    formatDateShort,
    formatDays,
    isIndefinite,
    toNumber,
    TSpofyState,
    TSpofyUser
} from '../format'
import { TSpofyKey, useSpofyT } from '../i18n'
import { SpofyShield } from '../spofy-shield'
import classes from '../spofy.module.css'

const STATUS_LABEL: Record<TSpofyState, TSpofyKey> = {
    active: 'statusActive',
    expiring: 'statusExpiring',
    expired: 'statusExpired',
    disabled: 'statusDisabled',
    limited: 'statusLimited'
}

interface IBannerProps {
    renewUrl: null | string
    state: TSpofyState
    supportUrl: null | string
    /** null when the tariff has no traffic limit or no URL is configured */
    trafficUrl: null | string
    user: TSpofyUser
}

/** First card: brand, controls, subscription status and the renewal actions. */
export function SubscriptionBanner(props: IBannerProps) {
    const { state, user, renewUrl, trafficUrl, supportUrl } = props
    const config = useAppConfig()
    const { t } = useSpofyT()

    const inactive = state === 'expired' || state === 'disabled' || state === 'limited'
    const title = config.brandingSettings.title || 'Spofy VPN'

    return (
        <section aria-labelledby="sp-brand" className={clsx(classes.card, classes.banner)}>
            <div className={classes.bannerTop}>
                <div className={classes.brandTile}>
                    <SpofyShield className={classes.brandIcon} />
                </div>
                <div className={classes.brandText}>
                    <h1 className={classes.brandName} id="sp-brand">
                        {title}
                    </h1>
                    <span className={classes.brandSub}>{t('yourSubscription')}</span>
                </div>
                <BannerControls supportUrl={supportUrl} />
            </div>

            {inactive && <InactiveCallout state={state} user={user} />}

            <div className={classes.stats}>
                <StatusTile state={state} user={user} />
                <TermTile state={state} user={user} />
                <TrafficTile user={user} />
            </div>

            <Actions
                renewUrl={renewUrl}
                state={state}
                supportUrl={supportUrl}
                trafficUrl={trafficUrl}
            />
        </section>
    )
}

function BannerControls({ supportUrl }: { supportUrl: null | string }) {
    const config = useAppConfig()
    const currentLang = useCurrentLang()
    const { setLanguage } = useAppConfigStoreActions()
    const { t } = useSpofyT()
    const SupportIcon = supportUrl?.includes('t.me') ? IconBrandTelegram : IconMessageCircle

    return (
        <div className={classes.controls}>
            {config.locales.length > 1 && (
                <LanguageMenu
                    currentLang={currentLang}
                    label={t('language')}
                    locales={config.locales}
                    onChange={setLanguage}
                />
            )}
            {supportUrl && (
                <a
                    aria-label={t('support')}
                    className={classes.iconBtn}
                    href={supportUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                    title={t('support')}
                >
                    <SupportIcon aria-hidden size={20} stroke={1.75} />
                </a>
            )}
        </div>
    )
}

function LanguageMenu(props: {
    currentLang: TSubscriptionPageLanguageCode
    label: string
    locales: TSubscriptionPageLanguageCode[]
    onChange: (lang: TSubscriptionPageLanguageCode) => void
}) {
    const { currentLang, label, locales, onChange } = props

    return (
        <Menu
            classNames={{ dropdown: classes.menuDropdown, item: classes.menuItem }}
            position="bottom-end"
            width={180}
            withinPortal
        >
            <Menu.Target>
                <button
                    aria-label={`${label}: ${getLanguageInfo(currentLang)?.nativeName ?? currentLang}`}
                    className={classes.iconBtn}
                    type="button"
                >
                    {currentLang.toUpperCase()}
                    <IconChevronDown aria-hidden size={14} stroke={2.25} />
                </button>
            </Menu.Target>
            <Menu.Dropdown>
                {locales.map((locale) => (
                    <Menu.Item
                        aria-current={locale === currentLang ? 'true' : undefined}
                        className={clsx(locale === currentLang && classes.menuItemActive)}
                        key={locale}
                        lang={locale}
                        onClick={() => onChange(locale)}
                    >
                        {getLanguageInfo(locale)?.nativeName ?? locale}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    )
}

function InactiveCallout({ state, user }: { state: TSpofyState; user: TSpofyUser }) {
    const { t } = useSpofyT()
    const hasReset = !!user.trafficLimitStrategy && user.trafficLimitStrategy !== 'NO_RESET'

    const copy =
        state === 'expired'
            ? { title: t('heroExpiredTitle'), text: t('heroExpiredText') }
            : state === 'disabled'
              ? { title: t('heroDisabledTitle'), text: t('heroDisabledText') }
              : {
                    title: t('heroLimitedTitle'),
                    text: hasReset ? t('heroLimitedResetText') : t('heroLimitedText')
                }

    return (
        <div className={classes.callout} role="status">
            <IconAlertCircle aria-hidden className={classes.calloutIcon} size={22} stroke={1.75} />
            <div>
                <h2 className={classes.calloutTitle}>{copy.title}</h2>
                <p className={classes.calloutText}>{copy.text}</p>
            </div>
        </div>
    )
}

function StatusTile({ state, user }: { state: TSpofyState; user: TSpofyUser }) {
    const { t } = useSpofyT()
    const tone = state === 'active' ? 'ok' : state === 'expiring' ? 'warning' : ('error' as const)

    return (
        <div className={classes.stat}>
            <span className={classes.statLabel}>{t('status')}</span>
            <span className={clsx(classes.statValue, classes.statusValue)}>
                <span
                    aria-hidden
                    className={clsx(
                        classes.dot,
                        tone === 'warning' && classes.dotWarning,
                        tone === 'error' && classes.dotError
                    )}
                />
                {t(STATUS_LABEL[state])}
            </span>
            <span className={classes.statCaption} title={user.username}>
                {user.username}
            </span>
        </div>
    )
}

function TermTile({ state, user }: { state: TSpofyState; user: TSpofyUser }) {
    const { t, lang } = useSpofyT()

    if (isIndefinite(user.expiresAt)) {
        return (
            <div className={classes.stat}>
                <span className={classes.statLabel}>{t('term')}</span>
                <span className={classes.statValue}>{t('indefiniteShort')}</span>
            </div>
        )
    }

    if (state === 'expired') {
        return (
            <div className={classes.stat}>
                <span className={classes.statLabel}>{t('ended')}</span>
                <span className={clsx(classes.statValue, classes.num)}>
                    {formatDateShort(user.expiresAt, lang)}
                </span>
            </div>
        )
    }

    const days = user.daysLeft
    return (
        <div className={classes.stat}>
            <span className={classes.statLabel}>{t('remaining')}</span>
            <span
                className={clsx(
                    classes.statValue,
                    classes.statValueLarge,
                    classes.num,
                    days <= EXPIRING_DAYS && classes.textWarning
                )}
            >
                {days > 0 ? `${days} ${formatDays(days, lang)}` : t('lastDay')}
            </span>
            <span className={classes.statCaption} title={formatDate(user.expiresAt, lang)}>
                {t('untilDate', { date: formatDateShort(user.expiresAt, lang) })}
            </span>
        </div>
    )
}

function TrafficTile({ user }: { user: TSpofyUser }) {
    const { t, lang } = useSpofyT()

    const used = toNumber(user.trafficUsedBytes)
    const limit = toNumber(user.trafficLimitBytes)
    const usedText = formatBytes(used, lang)

    if (limit <= 0) {
        return (
            <div className={clsx(classes.stat, classes.statWide)}>
                <div className={classes.statRow}>
                    <span className={classes.statLabel}>{t('traffic')}</span>
                    <span className={clsx(classes.statCaption, classes.num)}>
                        {t('usedAmount', { used: usedText })}
                    </span>
                </div>
                <span className={classes.statValue}>{t('unlimited')}</span>
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
        <div className={clsx(classes.stat, classes.statWide)}>
            <div className={classes.statRow}>
                <span className={classes.statLabel}>{t('traffic')}</span>
                <span
                    className={clsx(
                        classes.statCaption,
                        classes.num,
                        level === 'warning' && classes.textWarning,
                        level === 'error' && classes.textError
                    )}
                >
                    {t('trafficLeft', { p: leftPercent })}
                </span>
            </div>
            <span className={clsx(classes.statValue, classes.num)}>
                {t('trafficOf', { used: usedText, limit: formatBytes(limit, lang) })}
            </span>
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
            {resetKey && <span className={classes.statCaption}>{t(resetKey)}</span>}
        </div>
    )
}

function Actions(props: {
    renewUrl: null | string
    state: TSpofyState
    supportUrl: null | string
    trafficUrl: null | string
}) {
    const { renewUrl, trafficUrl, supportUrl, state } = props
    const { t } = useSpofyT()

    const trafficFirst = state === 'limited' && !!trafficUrl
    const renew = renewUrl && (
        <ActionLink
            href={renewUrl}
            icon={<IconRefresh aria-hidden size={20} stroke={2} />}
            key="renew"
            label={t('renew')}
            primary={!trafficFirst}
        />
    )
    const traffic = trafficUrl && (
        <ActionLink
            href={trafficUrl}
            icon={<IconPlus aria-hidden size={20} stroke={2} />}
            key="traffic"
            label={t('buyTraffic')}
            primary={trafficFirst}
        />
    )
    const support = state === 'disabled' && supportUrl && (
        <ActionLink href={supportUrl} key="support" label={t('writeSupport')} />
    )

    if (!renew && !traffic && !support) return null

    return (
        <div className={classes.btnRow}>
            {trafficFirst ? [traffic, renew] : [renew, traffic]}
            {support}
        </div>
    )
}

export function ActionLink(props: {
    href: string
    icon?: React.ReactNode
    label: string
    primary?: boolean
    small?: boolean
}) {
    return (
        <a
            className={clsx(
                classes.btn,
                props.primary ? classes.btnPrimary : classes.btnSecondary,
                props.small && classes.btnSmall
            )}
            href={props.href}
            rel="noopener noreferrer"
            target="_blank"
        >
            {props.icon}
            {props.label}
        </a>
    )
}
