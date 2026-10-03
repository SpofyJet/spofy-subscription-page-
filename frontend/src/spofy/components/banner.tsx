import { Menu } from '@mantine/core'
import { TSubscriptionPageLanguageCode } from '@remnawave/subscription-page-types'
// deep import: the package entry is CommonJS and pulls in every zod schema
import { getLanguageInfo } from '@remnawave/subscription-page-types/build/backend/constants'
import {
    IconArrowRight,
    IconArrowsUpDown,
    IconCalendarEvent,
    IconChevronDown,
    IconHourglassHigh,
    IconLifebuoy,
    IconPlus,
    IconRefresh
} from '@tabler/icons-react'
import clsx from 'clsx'

import { useAppConfig, useAppConfigStoreActions, useCurrentLang } from '@entities/app-config-store'

import { TCheckoutTab, useCheckoutStore } from '../checkout/checkout-store'
import {
    EXPIRING_DAYS,
    formatBytes,
    formatDateNumeric,
    formatDays,
    isIndefinite,
    toNumber,
    TSpofyState,
    TSpofyUser
} from '../format'
import { TSpofyKey, useSpofyT } from '../i18n'
import { SpofyShield } from '../spofy-shield'
import classes from '../spofy.module.css'

const STATUS_SHORT: Record<TSpofyState, TSpofyKey> = {
    active: 'wordActive',
    expiring: 'wordExpiring',
    expired: 'wordExpired',
    disabled: 'wordDisabled',
    limited: 'noTraffic'
}

const toneOf = (state: TSpofyState) =>
    state === 'active' ? 'ok' : state === 'expiring' ? 'warning' : 'error'

/* ───────────────────────── top bar ───────────────────────── */

export function TopBar(props: {
    displayName: null | string
    state: TSpofyState
    supportUrl: null | string
    user: TSpofyUser
}) {
    const { displayName, state, supportUrl, user } = props
    const config = useAppConfig()
    const currentLang = useCurrentLang()
    const { setLanguage } = useAppConfigStoreActions()
    const { t } = useSpofyT()
    const tone = toneOf(state)
    const name = displayName ?? user.username
    const initial = (name.replace(/^[^\p{L}\p{N}]+/u, '')[0] ?? 'S').toUpperCase()

    return (
        <header className={classes.topBar}>
            <div className={classes.who}>
                <span aria-hidden className={classes.avatar}>
                    {initial}
                </span>
                <span className={classes.whoText}>
                    <span className={classes.whoName} title={name}>
                        {name}
                    </span>
                    <span className={clsx(classes.whoStatus, classes[`tone_${tone}`])}>
                        <span aria-hidden className={classes.dot} />
                        {t(STATUS_SHORT[state])}
                    </span>
                </span>
            </div>
            <div className={classes.topActions}>
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
                        className={classes.pill}
                        href={supportUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        <IconLifebuoy aria-hidden size={18} stroke={1.8} />
                        {t('help')}
                    </a>
                )}
            </div>
        </header>
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
                    className={clsx(classes.pill, classes.pillCompact)}
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

/* ───────────────────────── hero ───────────────────────── */

interface IBannerProps {
    /** in-page checkout: CTAs open the sheet instead of linking to the bot */
    checkout: boolean
    renewUrl: null | string
    state: TSpofyState
    supportUrl: null | string
    /** null when the tariff has no traffic limit or no URL is configured */
    trafficUrl: null | string
    user: TSpofyUser
}

/** Dark hero with the big Spofy icon, then the stat tiles and the renewal action. */
export function SubscriptionBanner(props: IBannerProps) {
    const { checkout, state, user, renewUrl, trafficUrl, supportUrl } = props
    const openCheckout = useCheckoutStore((s) => s.open)
    const onBuy = checkout ? (tab: TCheckoutTab) => openCheckout(tab) : undefined
    const config = useAppConfig()
    const { t, lang } = useSpofyT()

    const tone = toneOf(state)
    const inactive = state === 'expired' || state === 'disabled' || state === 'limited'
    const title = config.brandingSettings.title || 'Spofy VPN'
    const hasReset = !!user.trafficLimitStrategy && user.trafficLimitStrategy !== 'NO_RESET'

    const lead = state === 'limited' ? t('heroLeadTraffic') : t('heroLeadSub')
    const word = t(
        (
            {
                active: 'wordActive',
                expiring: 'wordExpiring',
                expired: 'wordExpired',
                disabled: 'wordDisabled',
                limited: 'wordLimited'
            } as const
        )[state]
    )

    let line: string
    if (state === 'expired') line = t('heroExpiredText')
    else if (state === 'disabled') line = t('heroDisabledText')
    else if (state === 'limited') line = hasReset ? t('heroLimitedResetText') : t('heroLimitedText')
    else if (isIndefinite(user.expiresAt)) line = t('indefinite')
    else if (user.daysLeft <= 0) line = t('lastDay')
    else line = t('daysLeftLine', { n: user.daysLeft, days: formatDays(user.daysLeft, lang) })

    const showHeroCta = inactive || state === 'expiring'

    return (
        <section aria-labelledby="sp-hero" className={clsx(classes.card, classes.banner)}>
            <div className={clsx(classes.hero, classes[`hero_${tone}`])}>
                <div className={classes.heroBody}>
                    <span className={classes.brandPill}>
                        <SpofyShield className={classes.brandPillIcon} />
                        {title}
                    </span>
                    <h1 className={classes.heroTitle} id="sp-hero">
                        {lead}{' '}
                        <span className={clsx(classes.glow, classes[`glow_${tone}`])}>{word}</span>
                    </h1>
                    <p className={clsx(classes.heroLine, classes[`tone_${tone}`])}>
                        <span aria-hidden className={classes.dot} />
                        <span>{line}</span>
                    </p>
                </div>
                <div aria-hidden className={classes.heroIcon}>
                    <SpofyShield className={classes.heroIconShield} />
                </div>
            </div>

            <div className={classes.statTiles}>
                <DateTile onBuy={onBuy} renewUrl={renewUrl} state={state} user={user} />
                <DaysTile state={state} user={user} />
                <TrafficTile onBuy={onBuy} trafficUrl={trafficUrl} user={user} />
            </div>

            {showHeroCta && (
                <Actions
                    prominent
                    onBuy={onBuy}
                    renewUrl={renewUrl}
                    state={state}
                    supportUrl={supportUrl}
                    trafficUrl={trafficUrl}
                />
            )}
        </section>
    )
}

function Tile(props: {
    children: React.ReactNode
    cta?: { href?: null | string; label: string; onClick?: () => void } | null
    icon: React.ReactNode
    label: string
    tone?: 'error' | 'ok' | 'warning'
}) {
    return (
        <div className={clsx(classes.statTile, props.tone && classes[`statTile_${props.tone}`])}>
            <span className={classes.statTileLabel}>
                <span aria-hidden className={classes.statTileIcon}>
                    {props.icon}
                </span>
                {props.label}
            </span>
            <span className={classes.statTileValue}>{props.children}</span>
            {props.cta &&
                (props.cta.onClick ? (
                    <button
                        className={classes.statTileCta}
                        onClick={props.cta.onClick}
                        type="button"
                    >
                        {props.cta.label}
                        <IconArrowRight aria-hidden size={13} stroke={2.25} />
                    </button>
                ) : props.cta.href ? (
                    <a
                        className={classes.statTileCta}
                        href={props.cta.href}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        {props.cta.label}
                        <IconArrowRight aria-hidden size={13} stroke={2.25} />
                    </a>
                ) : null)}
        </div>
    )
}

function DateTile(props: {
    onBuy?: (tab: TCheckoutTab) => void
    renewUrl: null | string
    state: TSpofyState
    user: TSpofyUser
}) {
    const { onBuy, renewUrl, state, user } = props
    const { t, lang } = useSpofyT()
    const indefinite = isIndefinite(user.expiresAt)

    return (
        <Tile
            cta={
                indefinite
                    ? null
                    : onBuy
                      ? { label: t('renewShort'), onClick: () => onBuy('renew') }
                      : renewUrl
                        ? { href: renewUrl, label: t('renewShort') }
                        : null
            }
            icon={<IconCalendarEvent size={15} stroke={2} />}
            label={state === 'expired' ? t('ended') : t('validUntilLabel')}
            tone={state === 'expired' ? 'error' : undefined}
        >
            <span className={classes.num}>
                {indefinite ? '∞' : formatDateNumeric(user.expiresAt, lang)}
            </span>
        </Tile>
    )
}

function DaysTile({ state, user }: { state: TSpofyState; user: TSpofyUser }) {
    const { t } = useSpofyT()
    const indefinite = isIndefinite(user.expiresAt)
    const days = state === 'expired' ? 0 : Math.max(0, user.daysLeft)
    const tone =
        state === 'expired' ? 'error' : days <= EXPIRING_DAYS && !indefinite ? 'warning' : 'ok'

    return (
        <Tile icon={<IconHourglassHigh size={15} stroke={2} />} label={t('remaining')} tone={tone}>
            {indefinite ? (
                '∞'
            ) : (
                <>
                    <span className={clsx(classes.num, classes.glowSoft, classes[`glow_${tone}`])}>
                        {days}
                    </span>
                    <span className={classes.statTileUnit}>{t('daysShort')}</span>
                </>
            )}
        </Tile>
    )
}

function TrafficTile({
    onBuy,
    trafficUrl,
    user
}: {
    onBuy?: (tab: TCheckoutTab) => void
    trafficUrl: null | string
    user: TSpofyUser
}) {
    const { t, lang } = useSpofyT()
    const used = toNumber(user.trafficUsedBytes)
    const limit = toNumber(user.trafficLimitBytes)

    if (limit <= 0) {
        return (
            <Tile icon={<IconArrowsUpDown size={15} stroke={2} />} label={t('traffic')}>
                <span className={clsx(classes.glowSoft, classes.glow_accent)}>∞</span>
                <span className={clsx(classes.statTileUnit, classes.num)}>
                    {formatBytes(used, lang)}
                </span>
            </Tile>
        )
    }

    const share = Math.min(1, used / limit)
    const level = share >= 0.9 ? 'error' : share >= 0.5 ? 'warning' : 'ok'
    const usedPercent = Math.round(share * 100)
    const [num, unit] = formatBytes(used, lang).split(' ')

    return (
        <Tile
            cta={
                onBuy
                    ? { label: t('buyGb'), onClick: () => onBuy('traffic') }
                    : trafficUrl
                      ? { href: trafficUrl, label: t('buyGb') }
                      : null
            }
            icon={<IconArrowsUpDown size={15} stroke={2} />}
            label={t('traffic')}
            tone={level === 'ok' ? undefined : level}
        >
            <span className={classes.num}>{num}</span>
            <span className={clsx(classes.statTileUnit, classes.num)}>
                {unit} {t('ofLimit', { limit: formatBytes(limit, lang) })}
            </span>
            <span
                aria-label={t('traffic')}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={usedPercent}
                aria-valuetext={t('trafficLeft', { p: 100 - usedPercent })}
                className={classes.miniBar}
                role="progressbar"
            >
                <span
                    className={clsx(classes.miniBarFill, classes[`miniBar_${level}`])}
                    style={{ width: `${Math.max(usedPercent, used > 0 ? 3 : 0)}%` }}
                />
            </span>
        </Tile>
    )
}

function Actions(props: {
    onBuy?: (tab: TCheckoutTab) => void
    prominent: boolean
    renewUrl: null | string
    state: TSpofyState
    supportUrl: null | string
    trafficUrl: null | string
}) {
    const { onBuy, prominent, renewUrl, trafficUrl, supportUrl, state } = props
    const { t } = useSpofyT()

    const trafficFirst = state === 'limited' && (!!trafficUrl || !!onBuy)
    const renew = (renewUrl || onBuy) && (
        <ActionLink
            onClick={onBuy ? () => onBuy('renew') : undefined}
            glow={prominent && !trafficFirst}
            href={renewUrl ?? '#'}
            icon={<IconRefresh aria-hidden size={20} stroke={2} />}
            key="renew"
            label={t('renew')}
            primary={!trafficFirst}
        />
    )
    const traffic = prominent && (trafficUrl || (onBuy && state === 'limited')) && (
        <ActionLink
            onClick={onBuy ? () => onBuy('traffic') : undefined}
            glow={trafficFirst}
            href={trafficUrl ?? '#'}
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
    glow?: boolean
    href: string
    icon?: React.ReactNode
    label: string
    onClick?: () => void
    primary?: boolean
    small?: boolean
}) {
    const className = clsx(
        classes.btn,
        props.primary ? classes.btnPrimary : classes.btnSecondary,
        props.small && classes.btnSmall,
        props.glow && classes.btnGlow
    )
    if (props.onClick) {
        return (
            <button className={className} onClick={props.onClick} type="button">
                {props.icon}
                {props.label}
            </button>
        )
    }
    return (
        <a className={className} href={props.href} rel="noopener noreferrer" target="_blank">
            {props.icon}
            {props.label}
        </a>
    )
}
