import { Menu } from '@mantine/core'
import { TSubscriptionPageLanguageCode } from '@remnawave/subscription-page-types'
// deep import: the package entry is CommonJS and pulls in every zod schema
import { getLanguageInfo } from '@remnawave/subscription-page-types/build/backend/constants'
import {
    IconArrowsUpDown,
    IconCalendarEvent,
    IconDevices,
    IconChevronDown,
    IconLifebuoy,
    IconPlus,
    IconRefresh
} from '@tabler/icons-react'
import clsx from 'clsx'
import { useEffect } from 'react'

import { useAppConfig, useAppConfigStoreActions, useCurrentLang } from '@entities/app-config-store'

import { TCheckoutTab, useCheckoutStore } from '../checkout/checkout-store'
import { useMoney } from '../checkout/money'
import { cheapestTraffic } from '../checkout/offer-utils'
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
import { useSpofyData } from '../spofy-store'
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
    const loadOffer = useCheckoutStore((s) => s.loadOffer)
    const offerError = useCheckoutStore((s) => s.offerError)
    // Subscriptions the bot does not know keep the old behaviour: buttons link to the bot.
    const inPage = checkout && offerError !== 'coErrNotInBot'
    const onBuy = inPage ? (tab: TCheckoutTab) => openCheckout(tab) : undefined

    // Prefetch the offer shortly after paint: the sheet opens instantly and the tiles
    // only offer what the bot actually sells.
    useEffect(() => {
        if (!checkout) return
        const id = window.setTimeout(() => loadOffer(user.shortUuid), 600)
        return () => window.clearTimeout(id)
    }, [checkout, loadOffer, user.shortUuid])
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

    const offer = useCheckoutStore((s) => s.offer)
    const money = useMoney()
    const showHeroCta = inactive || state === 'expiring'
    const pack = inPage ? cheapestTraffic(offer) : null
    const trafficCta = pack
        ? {
              label: t('trafficBuy', {
                  gb: t('coGb', { n: pack.gb }),
                  price: money(pack.price_kopeks)
              }),
              onClick: () => openCheckout('traffic', { trafficGb: pack.gb })
          }
        : null

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
                <DevicesTile onBuy={onBuy} renewUrl={renewUrl} />
                <TrafficTile onBuy={onBuy} trafficUrl={trafficUrl} user={user} />
            </div>

            {showHeroCta && (
                <Actions
                    prominent
                    onBuy={onBuy}
                    trafficCta={trafficCta}
                    renewUrl={renewUrl}
                    state={state}
                    supportUrl={supportUrl}
                    trafficUrl={trafficUrl}
                />
            )}
        </section>
    )
}

interface ITileAction {
    href?: null | string
    icon: React.ReactNode
    label: string
    onClick?: () => void
}

function Tile(props: {
    action?: ITileAction | null
    caption?: React.ReactNode
    children: React.ReactNode
    icon: React.ReactNode
    label: string
    /** shown in place of the button when there is nothing to buy */
    note?: null | string
    tone?: 'error' | 'ok' | 'warning'
}) {
    const { action } = props
    return (
        <div className={clsx(classes.statTile, props.tone && classes[`statTile_${props.tone}`])}>
            <span aria-hidden className={classes.statTileIcon}>
                {props.icon}
            </span>
            <span className={classes.statTileLabel}>{props.label}</span>
            <span className={classes.statTileValue}>{props.children}</span>
            {props.caption && <span className={classes.statTileCaption}>{props.caption}</span>}
            {action &&
                (action.onClick ? (
                    <button className={classes.tileAction} onClick={action.onClick} type="button">
                        {action.icon}
                        {action.label}
                    </button>
                ) : action.href ? (
                    <a
                        className={classes.tileAction}
                        href={action.href}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        {action.icon}
                        {action.label}
                    </a>
                ) : null)}
            {!action && props.note && <span className={classes.tileNote}>{props.note}</span>}
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
    const days = state === 'expired' ? 0 : Math.max(0, user.daysLeft)
    const tone =
        state === 'expired' ? 'error' : days <= EXPIRING_DAYS && !indefinite ? 'warning' : undefined

    return (
        <Tile
            action={
                indefinite
                    ? null
                    : {
                          icon: <IconRefresh aria-hidden size={15} stroke={2.25} />,
                          label: t('renewShort'),
                          onClick: onBuy ? () => onBuy('renew') : undefined,
                          href: onBuy ? null : renewUrl
                      }
            }
            icon={<IconCalendarEvent size={16} stroke={2} />}
            label={state === 'expired' ? t('ended') : t('validUntilLabel')}
            tone={tone}
        >
            <span className={classes.num}>
                {indefinite ? '∞' : formatDateNumeric(user.expiresAt, lang)}
            </span>
        </Tile>
    )
}

function DevicesTile(props: { onBuy?: (tab: TCheckoutTab) => void; renewUrl: null | string }) {
    const { onBuy, renewUrl } = props
    const { t } = useSpofyT()
    const { devicesUsed, devicesLimit } = useSpofyData()
    const offer = useCheckoutStore((s) => s.offer)
    // Before the offer arrives we assume devices can be bought; hide once the bot says no.
    const sellable = !offer || (!!offer.devices.available && (offer.devices.can_add ?? 1) > 0)
    const limit = devicesLimit ?? offer?.devices.current_device_limit ?? null
    const full = devicesUsed !== null && limit !== null && devicesUsed >= limit

    return (
        <Tile
            action={
                (onBuy && sellable) || (!onBuy && renewUrl)
                    ? {
                          icon: <IconPlus aria-hidden size={15} stroke={2.5} />,
                          label: t('buyMore'),
                          onClick: onBuy ? () => onBuy('devices') : undefined,
                          href: onBuy ? null : renewUrl
                      }
                    : null
            }
            icon={<IconDevices size={16} stroke={2} />}
            label={t('devices')}
            note={limit === null ? t('devicesNoLimit') : null}
            tone={full ? 'warning' : undefined}
        >
            {devicesUsed !== null && limit !== null ? (
                <>
                    <span className={classes.num}>{devicesUsed}</span>
                    <span className={clsx(classes.statTileUnit, classes.num)}>
                        {t('ofLimit', { limit })}
                    </span>
                </>
            ) : devicesUsed !== null ? (
                <>
                    <span className={classes.num}>{devicesUsed}</span>
                    <span className={clsx(classes.statTileUnit, classes.num)}>
                        {t('ofLimit', { limit: '∞' })}
                    </span>
                </>
            ) : (
                <span className={classes.num}>{limit ?? '∞'}</span>
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
    const offer = useCheckoutStore((s) => s.offer)
    const used = toNumber(user.trafficUsedBytes)
    const limit = toNumber(user.trafficLimitBytes)
    const unlimited = limit <= 0
    // Optimistic until the offer arrives; the note and the button have the same size.
    const sellable = offer ? offer.traffic.length > 0 : true
    const action: ITileAction | null =
        onBuy && sellable
            ? {
                  icon: <IconPlus aria-hidden size={15} stroke={2.5} />,
                  label: t('buyGb'),
                  onClick: () => onBuy('traffic')
              }
            : !onBuy && trafficUrl && !unlimited
              ? {
                    icon: <IconPlus aria-hidden size={15} stroke={2.5} />,
                    label: t('buyGb'),
                    href: trafficUrl
                }
              : null

    if (unlimited) {
        return (
            <Tile
                action={action}
                icon={<IconArrowsUpDown size={16} stroke={2} />}
                label={t('traffic')}
                note={t('devicesNoLimit')}
            >
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
            action={action}
            caption={
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
            }
            icon={<IconArrowsUpDown size={16} stroke={2} />}
            label={t('traffic')}
            tone={level === 'ok' ? undefined : level}
        >
            <span className={classes.num}>{num}</span>
            <span className={clsx(classes.statTileUnit, classes.num)}>
                {unit} {t('ofLimit', { limit: formatBytes(limit, lang) })}
            </span>
        </Tile>
    )
}

function Actions(props: {
    onBuy?: (tab: TCheckoutTab) => void
    /** «Купить 50 ГБ за 99 ₽» with the package preselected */
    trafficCta?: { label: string; onClick: () => void } | null
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
            onClick={props.trafficCta?.onClick ?? (onBuy ? () => onBuy('traffic') : undefined)}
            glow={trafficFirst}
            href={trafficUrl ?? '#'}
            icon={<IconPlus aria-hidden size={20} stroke={2} />}
            key="traffic"
            label={props.trafficCta?.label ?? t('buyTraffic')}
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
