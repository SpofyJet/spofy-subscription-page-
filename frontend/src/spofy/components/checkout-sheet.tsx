import { Drawer, Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
    IconAlertCircle,
    IconArrowLeft,
    IconArrowRight,
    IconArrowsUpDown,
    IconBolt,
    IconCheck,
    IconCreditCard,
    IconCurrencyBitcoin,
    IconDevices,
    IconExternalLink,
    IconLoader2,
    IconLock,
    IconMinus,
    IconPlus,
    IconQrcode,
    IconRefresh,
    IconStar,
    IconWallet
} from '@tabler/icons-react'
import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'

import { vibrate } from '@shared/utils/vibrate'

import { useSubscription } from '@entities/subscription-info-store'

import {
    CheckoutError,
    checkoutApi,
    IOffer,
    IPeriodOption,
    isApplied,
    TCheckoutKind
} from '../checkout/api'
import {
    errorKey,
    IPendingPayment,
    KNOWN_ERROR_KEYS,
    loadMethod,
    saveMethod,
    TCheckoutTab,
    useCheckoutStore
} from '../checkout/checkout-store'
import { useMoney } from '../checkout/money'
import { TPhase } from '../checkout/pending'
import { formatDate, formatDays, formatPeriod, isIndefinite } from '../format'
import { TSpofyKey, useSpofyT } from '../i18n'
import { useQrDataUrl } from '../qr'
import classes from '../spofy.module.css'
import { PeriodCard } from './period-card'

const DAY_MS = 86_400_000

/* ───────────── sheet ───────────── */

const TAB_ICON: Record<TCheckoutTab, typeof IconRefresh> = {
    renew: IconRefresh,
    devices: IconDevices,
    traffic: IconArrowsUpDown
}

export default function CheckoutSheet({
    phase,
    renewUrl
}: {
    phase: TPhase | null
    renewUrl: null | string
}) {
    const { opened, close, pending, tab, offer, offerError, loadOffer } = useCheckoutStore()
    const subscription = useSubscription()
    const shortUuid = subscription.user.shortUuid
    const isDesktop = useMediaQuery('(min-width: 48em)')
    const { t } = useSpofyT()

    useEffect(() => {
        if (opened) loadOffer(shortUuid)
    }, [opened, shortUuid, loadOffer])

    const showPayment = !!pending && pending.shortUuid === shortUuid
    const trial = !!offer && (offer.subscription.is_trial || offer.renewal.length === 0)
    const titleKey: TSpofyKey = showPayment
        ? 'coStepPay'
        : tab === 'devices'
          ? 'coDevicesTitle'
          : tab === 'traffic'
            ? 'coTrafficTitle'
            : trial
              ? 'coTariffTitle'
              : 'coRenewTitle'
    const Icon = showPayment ? IconWallet : TAB_ICON[tab]

    const title = (
        <span className={classes.coTitle}>
            <span aria-hidden className={classes.coTitleIcon}>
                <Icon size={20} stroke={2} />
            </span>
            <span className={classes.coTitleText}>
                <span>{t(titleKey)}</span>
                <span className={classes.coTitleSub}>{t('coSub')}</span>
            </span>
        </span>
    )

    const body = showPayment ? (
        <PaymentStep pending={pending!} phase={phase} />
    ) : offerError ? (
        <ErrorBox
            errorKey={offerError}
            onRetry={offerError === 'coErrNotInBot' ? undefined : () => loadOffer(shortUuid, true)}
            renewUrl={renewUrl}
        />
    ) : offer ? (
        <Chooser offer={offer} renewUrl={renewUrl} />
    ) : (
        <SkeletonChooser />
    )

    const common = {
        opened,
        onClose: close,
        title,
        classNames: {
            content: classes.sheetContent,
            header: classes.sheetHeader,
            title: classes.sheetTitle,
            close: classes.modalClose,
            body: classes.sheetBody
        },
        closeButtonProps: { 'aria-label': t('close') },
        transitionProps: { duration: 180 }
    }

    return isDesktop ? (
        <Modal {...common} centered radius="lg" size={520}>
            {body}
        </Modal>
    ) : (
        <Drawer {...common} position="bottom" size="auto">
            {body}
        </Drawer>
    )
}

function SkeletonChooser() {
    const { t } = useSpofyT()
    return (
        <div aria-busy aria-label={t('coLoading')} className={classes.coStack} role="status">
            <div className={clsx(classes.skel, classes.skelTabs)} />
            <div className={classes.coGrid}>
                {[0, 1, 2, 3].map((i) => (
                    <div className={clsx(classes.skel, classes.skelCard)} key={i} />
                ))}
            </div>
            <div className={clsx(classes.skel, classes.skelRow)} />
            <div className={clsx(classes.skel, classes.skelRow)} />
        </div>
    )
}

function ErrorBox({
    detail,
    errorKey: key,
    onRetry,
    renewUrl
}: {
    detail?: null | string
    errorKey: TSpofyKey
    onRetry?: () => void
    renewUrl: null | string
}) {
    const { t } = useSpofyT()
    const botFallback =
        !!renewUrl &&
        (key === 'coErrDisabled' ||
            key === 'coErrBot' ||
            key === 'coErrNotInBot' ||
            key === 'coErrLoad')
    return (
        <div className={classes.coError} role="alert">
            <IconAlertCircle aria-hidden size={20} />
            <span className={classes.coErrorText}>
                {t(key)}
                {detail ? ` (${detail})` : ''}
            </span>
            {(onRetry || botFallback) && (
                <div className={classes.coErrorActions}>
                    {onRetry && (
                        <button
                            className={clsx(classes.btn, classes.btnSecondary, classes.btnSmall)}
                            onClick={onRetry}
                            type="button"
                        >
                            <IconRefresh aria-hidden size={16} />
                            {t('coRetry')}
                        </button>
                    )}
                    {botFallback && (
                        <a
                            className={clsx(classes.btn, classes.btnSecondary, classes.btnSmall)}
                            href={renewUrl!}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            {t('coOpenBot')}
                        </a>
                    )}
                </div>
            )}
        </div>
    )
}

/* ───────────── step 1: choose ───────────── */

function methodIcon(id: string) {
    const key = id.toLowerCase()
    if (key.includes('star')) return IconStar
    if (key.includes('sbp')) return IconBolt
    if (/crypt|heleket|ton|usdt|bitcoin/.test(key)) return IconCurrencyBitcoin
    if (/card|yookassa|tribute|pal24|platega|wata|mulen|freekassa|cloudpayments/.test(key))
        return IconCreditCard
    return IconWallet
}

function Chooser({ offer, renewUrl }: { offer: IOffer; renewUrl: null | string }) {
    const { t, lang } = useSpofyT()
    const money = useMoney()
    const subscription = useSubscription()
    const { tab: wantedTab, setTab, setPending, preset } = useCheckoutStore()

    const isTrial = offer.subscription.is_trial
    const canRenew = offer.renewal.length > 0
    const canTariff = offer.tariffs.length > 0
    const canDevices = !!offer.devices.available && (offer.devices.can_add ?? 1) > 0
    const canTraffic = offer.traffic.length > 0

    const tabs = (
        [
            ['renew', isTrial || !canRenew ? 'coTabTariff' : 'coTabRenew', canRenew || canTariff],
            ['devices', 'coTabDevices', canDevices],
            ['traffic', 'coTabTraffic', canTraffic]
        ] as [TCheckoutTab, TSpofyKey, boolean][]
    ).filter(([, , ok]) => ok)

    const tab = tabs.some(([key]) => key === wantedTab) ? wantedTab : (tabs[0]?.[0] ?? 'renew')
    useEffect(() => {
        if (tab !== wantedTab) setTab(tab)
    }, [tab, wantedTab, setTab])
    const tariffMode = tab === 'renew' && (isTrial || !canRenew)

    // A card or CTA on the page may have chosen the period / package already.
    const [period, setPeriod] = useState<number | null>(
        () =>
            (preset?.periodDays && offer.renewal.find((o) => o.period_days === preset.periodDays)
                ? preset.periodDays
                : null) ??
            (offer.renewal.find((o) => o.is_highlighted) ?? offer.renewal[0])?.period_days ??
            null
    )
    const [tariffId, setTariffId] = useState<number | null>(
        () =>
            (preset?.tariffId && offer.tariffs.some((x) => x.id === preset.tariffId)
                ? preset.tariffId
                : null) ??
            offer.tariffs[0]?.id ??
            null
    )
    const tariff = offer.tariffs.find((x) => x.id === tariffId) ?? offer.tariffs[0]
    const [tariffPeriod, setTariffPeriod] = useState<number | null>(
        () =>
            (preset?.periodDays && tariff?.periods.some((p) => p.period_days === preset.periodDays)
                ? preset.periodDays
                : null) ??
            (tariff?.periods.find((p) => p.is_highlighted) ?? tariff?.periods[0])?.period_days ??
            null
    )
    // Device prices are not linear (proration, free devices inside the tariff, discounts),
    // so only counts the bot has quoted can be chosen. An older bridge quotes one device.
    const deviceQuotes =
        offer.devices.quotes ??
        (typeof offer.devices.total_price_kopeks === 'number'
            ? [{ devices: 1, total_price_kopeks: offer.devices.total_price_kopeks }]
            : [])
    const maxAdd = Math.max(1, deviceQuotes.length)
    const [devices, setDevices] = useState(1)
    const [trafficGb, setTrafficGb] = useState<number | null>(() =>
        preset?.trafficGb !== undefined && offer.traffic.some((p) => p.gb === preset.trafficGb)
            ? preset.trafficGb
            : (offer.traffic[0]?.gb ?? null)
    )
    const [methodId, setMethodId] = useState<string | null>(() => {
        const saved = loadMethod()
        return offer.payment_methods.some((m) => m.id === saved)
            ? saved
            : (offer.payment_methods[0]?.id ?? null)
    })
    const method = offer.payment_methods.find((m) => m.id === methodId)
    const [optionId, setOptionId] = useState<null | string>(method?.options?.[0]?.id ?? null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<TSpofyKey | null>(null)
    const [errorDetail, setErrorDetail] = useState<null | string>(null)

    useEffect(() => {
        setOptionId(method?.options?.[0]?.id ?? null)
    }, [methodId])

    const deviceQuote = deviceQuotes.find((q) => q.devices === devices)
    const deviceFree = tab === 'devices' && !!deviceQuote && deviceQuote.total_price_kopeks === 0
    const freeDevices = deviceQuotes.filter((q) => q.total_price_kopeks === 0).length

    const selectedPeriod = tariffMode
        ? tariff?.periods.find((p) => p.period_days === tariffPeriod)
        : offer.renewal.find((o) => o.period_days === period)

    const price = useMemo(() => {
        if (tab === 'renew') return selectedPeriod?.price_kopeks ?? 0
        if (tab === 'devices') return deviceQuote?.total_price_kopeks ?? 0
        return offer.traffic.find((p) => p.gb === trafficGb)?.price_kopeks ?? 0
    }, [tab, selectedPeriod, deviceQuote, trafficGb, offer])

    if (tabs.length === 0 || offer.payment_methods.length === 0 || !offer.checkout_enabled) {
        return (
            <ErrorBox
                errorKey={!offer.checkout_enabled ? 'coErrDisabled' : 'coNothing'}
                renewUrl={renewUrl}
            />
        )
    }

    const original =
        tab === 'renew' &&
        selectedPeriod?.original_price_kopeks &&
        selectedPeriod.original_price_kopeks > price
            ? selectedPeriod.original_price_kopeks
            : null

    /* the date a renewal runs to, counted from today when the subscription has ended */
    const currentEnd = offer.subscription.end_date
        ? Date.parse(offer.subscription.end_date)
        : new Date(subscription.user.expiresAt).getTime()
    const newEnd =
        tab === 'renew' && !tariffMode && period && !isIndefinite(new Date(currentEnd))
            ? Math.max(currentEnd, Date.now()) + period * DAY_MS
            : null

    const currentDevices = offer.devices.current_device_limit ?? offer.subscription.device_limit
    const currentGb = offer.subscription.traffic_limit_gb
    const trafficLabel = (gb: number) => (gb === 0 ? t('coUnlimited') : t('coGb', { n: gb }))

    const summary = (): string => {
        if (tab === 'devices') return t('coSummaryDevices', { n: devices })
        if (tab === 'traffic') return t('coSummaryTraffic', { gb: trafficLabel(trafficGb ?? 0) })
        const p = formatPeriod(selectedPeriod?.period_days ?? 0, lang)
        return tariffMode && tariff
            ? t('coSummaryTariff', { name: tariff.name, period: p })
            : t('coSummaryRenew', { period: p })
    }

    const submit = async () => {
        if (!method || price <= 0) return
        setBusy(true)
        setError(null)
        setErrorDetail(null)
        const kind: TCheckoutKind = tab === 'renew' ? (tariffMode ? 'tariff' : 'renew') : tab
        try {
            const result = await checkoutApi.checkout(subscription.user.shortUuid, {
                kind,
                payment_method: method.id,
                payment_option: optionId,
                ...(kind === 'renew' ? { period_days: period ?? undefined } : {}),
                ...(kind === 'tariff'
                    ? { tariff_id: tariff?.id, period_days: tariffPeriod ?? undefined }
                    : {}),
                ...(kind === 'devices' ? { devices } : {}),
                ...(kind === 'traffic' ? { traffic_gb: trafficGb ?? undefined } : {})
            })
            vibrate('tap')
            saveMethod(method.id)
            setPending({
                createdAt: Date.now(),
                kind,
                result,
                shortUuid: subscription.user.shortUuid,
                summary: summary()
            })
        } catch (err) {
            const key = errorKey(err)
            setError(key)
            setErrorDetail(
                err instanceof CheckoutError && !KNOWN_ERROR_KEYS.includes(key) ? err.detail : null
            )
        } finally {
            setBusy(false)
        }
    }

    const checkMark = (
        <span aria-hidden className={classes.coCardCheck}>
            <IconCheck size={12} stroke={3} />
        </span>
    )

    const periodGrid = (
        options: IPeriodOption[],
        value: number | null,
        onChange: (v: number) => void
    ) => (
        <div aria-label={t('coPeriod')} className={classes.coGrid} role="radiogroup">
            {options.map((option) => (
                <PeriodCard
                    checked={option.period_days === value}
                    key={option.period_days}
                    onClick={() => {
                        vibrate('tap')
                        onChange(option.period_days)
                    }}
                    option={option}
                />
            ))}
        </div>
    )

    return (
        <div className={classes.coStack}>
            {tabs.length > 1 && (
                <div aria-label={t('coRenewTitle')} className={classes.coTabs} role="tablist">
                    {tabs.map(([key, label]) => {
                        const TabIcon = TAB_ICON[key]
                        return (
                            <button
                                aria-selected={key === tab}
                                className={classes.coTab}
                                key={key}
                                onClick={() => {
                                    setTab(key)
                                    setError(null)
                                }}
                                role="tab"
                                type="button"
                            >
                                <TabIcon aria-hidden size={16} stroke={2.25} />
                                {t(label)}
                            </button>
                        )
                    })}
                </div>
            )}

            {tab === 'renew' && !tariffMode && periodGrid(offer.renewal, period, setPeriod)}

            {tab === 'renew' && tariffMode && tariff && (
                <>
                    {offer.tariffs.length > 1 && (
                        <div className={classes.coList} role="radiogroup">
                            {offer.tariffs.map((x) => (
                                <button
                                    aria-checked={x.id === tariff.id}
                                    className={classes.coRow}
                                    key={x.id}
                                    onClick={() => {
                                        setTariffId(x.id)
                                        setTariffPeriod(
                                            (
                                                x.periods.find((p) => p.is_highlighted) ??
                                                x.periods[0]
                                            )?.period_days ?? null
                                        )
                                    }}
                                    role="radio"
                                    type="button"
                                >
                                    <span className={classes.coRowText}>
                                        <span className={classes.coRowTitle}>{x.name}</span>
                                        {x.description && (
                                            <span className={classes.coRowMeta}>
                                                {x.description}
                                            </span>
                                        )}
                                    </span>
                                    <span aria-hidden className={classes.coRadio} />
                                </button>
                            ))}
                        </div>
                    )}
                    {periodGrid(tariff.periods, tariffPeriod, setTariffPeriod)}
                </>
            )}

            {tab === 'devices' && (
                <div className={classes.coDevices}>
                    <div className={classes.coDevicesHead}>
                        <span className={classes.coLabel}>{t('coDevicesChange')}</span>
                    </div>
                    <div className={classes.coStepper}>
                        <button
                            aria-label="−1"
                            className={classes.coStepBtn}
                            disabled={devices <= 1}
                            onClick={() => setDevices((n) => Math.max(1, n - 1))}
                            type="button"
                        >
                            <IconMinus aria-hidden size={20} />
                        </button>
                        <output
                            aria-live="polite"
                            className={clsx(classes.coStepValue, classes.num)}
                        >
                            <span className={classes.coStepFrom}>{currentDevices}</span>
                            <IconArrowRight aria-hidden className={classes.coStepArrow} size={18} />
                            <span className={clsx(classes.glowSoft, classes.glow_accent)}>
                                {currentDevices + devices}
                            </span>
                        </output>
                        <button
                            aria-label="+1"
                            className={classes.coStepBtn}
                            disabled={devices >= maxAdd}
                            onClick={() => setDevices((n) => Math.min(maxAdd, n + 1))}
                            type="button"
                        >
                            <IconPlus aria-hidden size={20} />
                        </button>
                    </div>
                    {offer.devices.base_device_price_kopeks ? (
                        <span className={classes.coHint}>
                            {t('coDeviceBase', {
                                price: money(offer.devices.base_device_price_kopeks)
                            })}
                            {offer.devices.days_left
                                ? ` · ${t('coDeviceProrated', { n: offer.devices.days_left, days: formatDays(offer.devices.days_left, lang) })}`
                                : ''}
                        </span>
                    ) : null}
                </div>
            )}

            {tab === 'devices' && deviceQuote && (
                <div className={classes.coResult}>
                    <span>
                        {deviceFree
                            ? t('coDeviceFree')
                            : freeDevices > 0
                              ? t('coDeviceSomeFree', { n: freeDevices })
                              : t('coTotal')}
                    </span>
                    <strong className={classes.num}>
                        {deviceFree ? t('coFree') : money(deviceQuote.total_price_kopeks)}
                        {deviceQuote.discount_percent ? (
                            <span className={clsx(classes.coBadge, classes.coBadgeSale)}>
                                −{deviceQuote.discount_percent}%
                            </span>
                        ) : null}
                    </strong>
                </div>
            )}

            {tab === 'traffic' && (
                <div aria-label={t('coTabTraffic')} className={classes.coGrid} role="radiogroup">
                    {offer.traffic.map((p) => (
                        <button
                            aria-checked={p.gb === trafficGb}
                            className={classes.coCard}
                            key={p.gb}
                            onClick={() => {
                                vibrate('tap')
                                setTrafficGb(p.gb)
                            }}
                            role="radio"
                            type="button"
                        >
                            {p.discount_percent ? (
                                <span className={classes.coCardBadges}>
                                    <span className={clsx(classes.coBadge, classes.coBadgeSale)}>
                                        −{p.discount_percent}%
                                    </span>
                                </span>
                            ) : null}
                            <span className={classes.coCardTitle}>{trafficLabel(p.gb)}</span>
                            <span className={clsx(classes.coCardPrice, classes.num)}>
                                {money(p.price_kopeks)}
                            </span>
                            {checkMark}
                        </button>
                    ))}
                </div>
            )}

            {tab === 'traffic' && currentGb > 0 && trafficGb !== null && (
                <div className={classes.coResult}>
                    <span>{t('coTrafficChange')}</span>
                    <strong className={classes.num}>
                        {t('coGb', { n: currentGb })}
                        <IconArrowRight aria-hidden size={14} />
                        {trafficGb === 0
                            ? t('coUnlimited')
                            : t('coGb', { n: currentGb + trafficGb })}
                    </strong>
                </div>
            )}

            {newEnd && (
                <div className={classes.coResult}>
                    <span>{t('coUntilLabel')}</span>
                    <strong className={classes.num}>{formatDate(new Date(newEnd), lang)}</strong>
                </div>
            )}

            {!deviceFree && (
                <div className={classes.coSection}>
                    <div className={classes.coLabel}>{t('coMethod')}</div>
                    <div aria-label={t('coMethod')} className={classes.coList} role="radiogroup">
                        {offer.payment_methods.map((m) => {
                            const MethodIcon = methodIcon(m.id)
                            return [
                                <button
                                    aria-checked={m.id === methodId}
                                    className={classes.coRow}
                                    key={m.id}
                                    onClick={() => setMethodId(m.id)}
                                    role="radio"
                                    type="button"
                                >
                                    <span aria-hidden className={classes.coRowIcon}>
                                        <MethodIcon size={20} stroke={1.9} />
                                    </span>
                                    <span className={classes.coRowText}>
                                        <span className={classes.coRowTitle}>{m.name}</span>
                                        {m.description && (
                                            <span className={classes.coRowMeta}>
                                                {m.description}
                                            </span>
                                        )}
                                    </span>
                                    <span aria-hidden className={classes.coRadio} />
                                </button>,
                                m.id === methodId && m.options && m.options.length > 1 ? (
                                    <div
                                        className={classes.coChips}
                                        key={`${m.id}-options`}
                                        role="radiogroup"
                                    >
                                        {m.options.map((o) => (
                                            <button
                                                aria-checked={o.id === optionId}
                                                className={classes.coChip}
                                                key={o.id}
                                                onClick={() => setOptionId(o.id)}
                                                role="radio"
                                                type="button"
                                            >
                                                {o.name}
                                            </button>
                                        ))}
                                    </div>
                                ) : null
                            ]
                        })}
                    </div>
                </div>
            )}

            {error && <ErrorBox detail={errorDetail} errorKey={error} renewUrl={renewUrl} />}

            <div className={classes.coFooter}>
                {deviceFree && renewUrl ? (
                    <a
                        className={clsx(classes.btn, classes.btnPrimary, classes.coPayBtn)}
                        href={renewUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        {t('coAddFreeInBot')}
                    </a>
                ) : (
                    <button
                        className={clsx(
                            classes.btn,
                            classes.btnPrimary,
                            classes.btnGlow,
                            classes.coPayBtn
                        )}
                        disabled={busy || price <= 0 || !method}
                        onClick={submit}
                        type="button"
                    >
                        {busy ? (
                            <IconLoader2 aria-hidden className={classes.spin} size={20} />
                        ) : (
                            <IconLock aria-hidden size={18} stroke={2.25} />
                        )}
                        <span>{t('coPay', { price: money(price) })}</span>
                        {original && <s className={classes.coPayStrike}>{money(original)}</s>}
                    </button>
                )}
                {!deviceFree && <span className={classes.coSecure}>{t('coSecure')}</span>}
            </div>
        </div>
    )
}

/* ───────────── step 2: pay ───────────── */

function PaymentStep({ pending, phase }: { pending: IPendingPayment; phase: TPhase | null }) {
    const { t, lang } = useSpofyT()
    const money = useMoney()
    const { setPending, close, latest } = useCheckoutStore()
    const [showQr, setShowQr] = useState(false)
    const { result } = pending
    const qrSrc = useQrDataUrl(showQr ? result.qr_payload || result.payment_url : null)

    const done = phase === 'done'
    const paid = done || phase === 'paid'
    const rest = result.amount_kopeks - result.price_kopeks
    const end = latest?.end_date ?? null

    if (done) {
        return (
            <div className={clsx(classes.coStack, classes.coSuccess)} role="status">
                <span aria-hidden className={classes.coSuccessIcon}>
                    <IconCheck size={34} stroke={2.5} />
                </span>
                <strong className={classes.coSuccessTitle}>{t('coDone')}</strong>
                {pending.summary && <span className={classes.coHint}>{pending.summary}</span>}
                {end && !isIndefinite(end) && (
                    <span className={clsx(classes.coSuccessDate, classes.num)}>
                        {t('coDoneUntil', { date: formatDate(end, lang) })}
                    </span>
                )}
                <button
                    className={clsx(classes.btn, classes.btnPrimary, classes.coPayBtn)}
                    onClick={() => {
                        setPending(null)
                        close()
                        window.location.reload()
                    }}
                    type="button"
                >
                    {t('coClose')}
                </button>
            </div>
        )
    }

    const steps: { key: TSpofyKey; state: 'active' | 'done' | 'todo' }[] = [
        { key: 'coStepCreated', state: 'done' },
        { key: 'coStepPay', state: paid ? 'done' : 'active' },
        { key: 'coStepApply', state: paid ? 'active' : 'todo' }
    ]

    return (
        <div className={classes.coStack}>
            <div className={classes.coOrder}>
                <span className={classes.coRowText}>
                    <span className={classes.coRowTitle}>{pending.summary ?? t('coTotal')}</span>
                    {rest > 0 && (
                        <span className={classes.coRowMeta}>
                            {t('coMinNote', {
                                amount: money(result.amount_kopeks),
                                rest: money(rest)
                            })}
                        </span>
                    )}
                </span>
                <strong className={clsx(classes.coOrderPrice, classes.num)}>
                    {money(result.amount_kopeks)}
                </strong>
            </div>

            <ol className={classes.coSteps}>
                {steps.map((step, i) => (
                    <li
                        className={clsx(classes.coStep, classes[`coStep_${step.state}`])}
                        key={step.key}
                    >
                        <span aria-hidden className={classes.coStepDot}>
                            {step.state === 'done' ? (
                                <IconCheck size={13} stroke={3} />
                            ) : step.state === 'active' ? (
                                <IconLoader2 className={classes.spin} size={13} stroke={2.5} />
                            ) : (
                                i + 1
                            )}
                        </span>
                        <span>{t(step.key)}</span>
                    </li>
                ))}
            </ol>

            <p aria-live="polite" className={classes.coHint} role="status">
                {phase === 'paid'
                    ? t('coPaid')
                    : phase === 'timeout'
                      ? t('coTimeout')
                      : t('coPayHint')}
            </p>

            {!paid && (
                <a
                    className={clsx(
                        classes.btn,
                        classes.btnPrimary,
                        classes.btnGlow,
                        classes.coPayBtn
                    )}
                    href={result.payment_url}
                    onClick={() => vibrate('tap')}
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    {t('coPay', { price: money(result.amount_kopeks) })}
                    <IconExternalLink aria-hidden size={18} />
                </a>
            )}

            <div className={classes.coPayRow}>
                {!paid && (
                    <button
                        aria-expanded={showQr}
                        className={clsx(classes.btn, classes.btnSecondary, classes.btnSmall)}
                        onClick={() => setShowQr((v) => !v)}
                        type="button"
                    >
                        <IconQrcode aria-hidden size={18} />
                        {t('coOtherDevice')}
                    </button>
                )}
                <button
                    className={clsx(classes.btn, classes.btnGhost, classes.btnSmall)}
                    onClick={() => setPending(null)}
                    type="button"
                >
                    <IconArrowLeft aria-hidden size={18} />
                    {t('coBack')}
                </button>
            </div>
            {showQr && !paid && qrSrc && (
                <img alt={t('coOtherDevice')} className={classes.coQr} src={qrSrc} />
            )}
        </div>
    )
}
