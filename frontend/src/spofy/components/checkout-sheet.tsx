import { Drawer, Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
    IconAlertCircle,
    IconArrowLeft,
    IconCheck,
    IconExternalLink,
    IconLoader2,
    IconMinus,
    IconPlus,
    IconQrcode
} from '@tabler/icons-react'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { renderSVG } from 'uqr'

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
import { IPendingPayment, TCheckoutTab, useCheckoutStore } from '../checkout/checkout-store'
import { formatDays } from '../format'
import { TSpofyKey, useSpofyT } from '../i18n'
import classes from '../spofy.module.css'

const POLL_MS = 4_000
const GIVE_UP_MS = 15 * 60_000

export function useMoney() {
    const { lang } = useSpofyT()
    return useCallback(
        (kopeks: number) =>
            new Intl.NumberFormat(lang === 'en' ? 'en-GB' : lang, {
                style: 'currency',
                currency: 'RUB',
                maximumFractionDigits: kopeks % 100 === 0 ? 0 : 2
            }).format(kopeks / 100),
        [lang]
    )
}

const errorKey = (error: unknown): TSpofyKey => {
    if (!(error instanceof CheckoutError)) return 'coErrGeneric'
    if (error.code === 'rate_limited') return 'coErrRate'
    if (error.code === 'no_session') return 'coErrSession'
    if (error.code === 'bot_unavailable' || error.code === 'network') return 'coErrBot'
    if (error.status === 409 || error.code === 'checkout_disabled') return 'coErrDisabled'
    if (error.code === 'bridge_error' && error.status === 404) return 'coErrNotInBot'
    return 'coErrGeneric'
}

/* ───────────── payment status watcher (runs while a payment is pending) ───────────── */

export type TPhase = 'done' | 'paid' | 'timeout' | 'waiting'

export function usePendingPhase(): TPhase | null {
    const pending = useCheckoutStore((s) => s.pending)
    const subscription = useSubscription()
    const [phase, setPhase] = useState<TPhase | null>(null)

    useEffect(() => {
        if (!pending || pending.shortUuid !== subscription.user.shortUuid) {
            setPhase(null)
            return
        }
        let stopped = false
        let timer: number | undefined
        setPhase('waiting')

        const tick = async () => {
            if (stopped) return
            if (Date.now() - pending.createdAt > GIVE_UP_MS) {
                setPhase('timeout')
                return
            }
            try {
                const status = await checkoutApi.status(
                    pending.shortUuid,
                    pending.result.method,
                    pending.result.payment_id
                )
                if (isApplied(pending.kind, pending.result.before, status.subscription)) {
                    vibrate('success')
                    setPhase('done')
                    return
                }
                if (status.is_paid) setPhase('paid')
            } catch {
                // transient: keep polling
            }
            timer = window.setTimeout(tick, POLL_MS)
        }
        timer = window.setTimeout(tick, 1_500)
        return () => {
            stopped = true
            window.clearTimeout(timer)
        }
    }, [pending, subscription.user.shortUuid])

    return phase
}

/* ───────────── sheet ───────────── */

export function CheckoutSheet({
    phase,
    renewUrl
}: {
    phase: TPhase | null
    renewUrl: null | string
}) {
    const { opened, close, pending } = useCheckoutStore()
    const subscription = useSubscription()
    const shortUuid = subscription.user.shortUuid
    const isDesktop = useMediaQuery('(min-width: 48em)')
    const { t } = useSpofyT()
    const [offer, setOffer] = useState<IOffer | null>(null)
    const [loadError, setLoadError] = useState<TSpofyKey | null>(null)

    useEffect(() => {
        if (!opened || offer) return
        setLoadError(null)
        checkoutApi
            .offer(shortUuid)
            .then(setOffer)
            .catch((error) => setLoadError(errorKey(error)))
    }, [opened, offer, shortUuid])

    const showPayment = !!pending && pending.shortUuid === shortUuid
    const title = showPayment ? t('coPay', { price: '' }).trim() : t('coRenewTitle')

    const body = showPayment ? (
        <PaymentStep pending={pending!} phase={phase} />
    ) : loadError ? (
        <ErrorBox errorKey={loadError} renewUrl={renewUrl} />
    ) : offer ? (
        <Chooser offer={offer} renewUrl={renewUrl} />
    ) : (
        <div className={classes.coLoading}>
            <IconLoader2 aria-hidden className={classes.spin} size={22} />
            {t('coLoading')}
        </div>
    )

    const common = {
        opened,
        onClose: close,
        title,
        classNames: {
            content: classes.sheetContent,
            header: classes.sheetHeader,
            title: classes.modalTitle,
            close: classes.modalClose,
            body: classes.sheetBody
        },
        closeButtonProps: { 'aria-label': t('close') },
        transitionProps: { duration: 150 }
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

function ErrorBox({ errorKey: key, renewUrl }: { errorKey: TSpofyKey; renewUrl: null | string }) {
    const { t } = useSpofyT()
    return (
        <div className={classes.coError} role="alert">
            <IconAlertCircle aria-hidden size={20} />
            <span>{t(key)}</span>
            {renewUrl &&
                (key === 'coErrDisabled' || key === 'coErrBot' || key === 'coErrNotInBot') && (
                    <a
                        className={clsx(classes.btn, classes.btnSecondary, classes.btnSmall)}
                        href={renewUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        {t('coOpenBot')}
                    </a>
                )}
        </div>
    )
}

/* ───────────── step 1: choose ───────────── */

function Chooser({ offer, renewUrl }: { offer: IOffer; renewUrl: null | string }) {
    const { t, lang } = useSpofyT()
    const money = useMoney()
    const subscription = useSubscription()
    const { tab: initialTab, setPending } = useCheckoutStore()

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

    const [tab, setTab] = useState<TCheckoutTab>(
        tabs.some(([key]) => key === initialTab) ? initialTab : (tabs[0]?.[0] ?? 'renew')
    )
    const tariffMode = tab === 'renew' && (isTrial || !canRenew)

    const [period, setPeriod] = useState<number | null>(
        () => (offer.renewal.find((o) => o.is_highlighted) ?? offer.renewal[0])?.period_days ?? null
    )
    const [tariffId, setTariffId] = useState<number | null>(offer.tariffs[0]?.id ?? null)
    const tariff = offer.tariffs.find((x) => x.id === tariffId) ?? offer.tariffs[0]
    const [tariffPeriod, setTariffPeriod] = useState<number | null>(
        () =>
            (tariff?.periods.find((p) => p.is_highlighted) ?? tariff?.periods[0])?.period_days ??
            null
    )
    const maxAdd = Math.max(1, Math.min(offer.devices.can_add ?? 5, 10))
    const [devices, setDevices] = useState(1)
    const [trafficGb, setTrafficGb] = useState<number | null>(offer.traffic[0]?.gb ?? null)
    const [methodId, setMethodId] = useState<string | null>(offer.payment_methods[0]?.id ?? null)
    const method = offer.payment_methods.find((m) => m.id === methodId)
    const [optionId, setOptionId] = useState<null | string>(method?.options?.[0]?.id ?? null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<TSpofyKey | null>(null)
    const [errorDetail, setErrorDetail] = useState<null | string>(null)

    useEffect(() => {
        setOptionId(method?.options?.[0]?.id ?? null)
    }, [methodId])

    const price = useMemo(() => {
        if (tab === 'renew' && !tariffMode)
            return offer.renewal.find((o) => o.period_days === period)?.price_kopeks ?? 0
        if (tab === 'renew')
            return tariff?.periods.find((p) => p.period_days === tariffPeriod)?.price_kopeks ?? 0
        if (tab === 'devices') return (offer.devices.price_per_device_kopeks ?? 0) * devices
        return offer.traffic.find((p) => p.gb === trafficGb)?.price_kopeks ?? 0
    }, [tab, tariffMode, period, tariff, tariffPeriod, devices, trafficGb, offer])

    if (tabs.length === 0 || offer.payment_methods.length === 0 || !offer.checkout_enabled) {
        return (
            <ErrorBox
                errorKey={!offer.checkout_enabled ? 'coErrDisabled' : 'coNothing'}
                renewUrl={renewUrl}
            />
        )
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
            setPending({
                createdAt: Date.now(),
                kind,
                result,
                shortUuid: subscription.user.shortUuid
            })
        } catch (err) {
            setError(errorKey(err))
            setErrorDetail(err instanceof CheckoutError ? err.detail : null)
        } finally {
            setBusy(false)
        }
    }

    const periodList = (
        options: IPeriodOption[],
        value: number | null,
        onChange: (v: number) => void
    ) => (
        <div aria-label={t('coPeriod')} className={classes.coOptions} role="radiogroup">
            {options.map((option) => (
                <button
                    aria-checked={option.period_days === value}
                    className={classes.coOption}
                    key={option.period_days}
                    onClick={() => onChange(option.period_days)}
                    role="radio"
                    type="button"
                >
                    <span className={classes.coOptionMain}>
                        {t('coDays', {
                            n: option.period_days,
                            days: formatDays(option.period_days, lang)
                        })}
                        {option.is_highlighted && (
                            <span className={classes.coBadge}>{t('coBest')}</span>
                        )}
                    </span>
                    <span className={classes.coOptionPrice}>
                        {option.original_price_kopeks &&
                            option.original_price_kopeks > option.price_kopeks && (
                                <s className={classes.coStrike}>
                                    {money(option.original_price_kopeks)}
                                </s>
                            )}
                        {money(option.price_kopeks)}
                    </span>
                </button>
            ))}
        </div>
    )

    return (
        <div className={classes.coStack}>
            {tabs.length > 1 && (
                <div aria-label={t('coRenewTitle')} className={classes.coTabs} role="tablist">
                    {tabs.map(([key, label]) => (
                        <button
                            aria-selected={key === tab}
                            className={classes.coTab}
                            key={key}
                            onClick={() => setTab(key)}
                            role="tab"
                            type="button"
                        >
                            {t(label)}
                        </button>
                    ))}
                </div>
            )}

            {tab === 'renew' && !tariffMode && periodList(offer.renewal, period, setPeriod)}

            {tab === 'renew' && tariffMode && tariff && (
                <>
                    {offer.tariffs.length > 1 && (
                        <div className={classes.coOptions} role="radiogroup">
                            {offer.tariffs.map((x) => (
                                <button
                                    aria-checked={x.id === tariff.id}
                                    className={classes.coOption}
                                    key={x.id}
                                    onClick={() => {
                                        setTariffId(x.id)
                                        setTariffPeriod(x.periods[0]?.period_days ?? null)
                                    }}
                                    role="radio"
                                    type="button"
                                >
                                    <span className={classes.coOptionMain}>{x.name}</span>
                                    <span className={classes.coOptionMeta}>{x.description}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {periodList(tariff.periods, tariffPeriod, setTariffPeriod)}
                </>
            )}

            {tab === 'devices' && (
                <div className={classes.coDevices}>
                    <div>
                        <div className={classes.coLabel}>{t('coDevicesAdd')}</div>
                        <div className={classes.coHint}>
                            {t('coDevicesNow', {
                                n: offer.devices.current_device_limit ?? 1,
                                max: offer.devices.max_device_limit ?? '∞'
                            })}
                        </div>
                    </div>
                    <div className={classes.coStepper}>
                        <button
                            aria-label="−1"
                            className={classes.coStepBtn}
                            disabled={devices <= 1}
                            onClick={() => setDevices((n) => Math.max(1, n - 1))}
                            type="button"
                        >
                            <IconMinus aria-hidden size={18} />
                        </button>
                        <output aria-live="polite" className={classes.coStepValue}>
                            {devices}
                        </output>
                        <button
                            aria-label="+1"
                            className={classes.coStepBtn}
                            disabled={devices >= maxAdd}
                            onClick={() => setDevices((n) => Math.min(maxAdd, n + 1))}
                            type="button"
                        >
                            <IconPlus aria-hidden size={18} />
                        </button>
                    </div>
                    <div className={clsx(classes.coHint, classes.coFull)}>
                        {t('coPerDevice', {
                            price: money(offer.devices.price_per_device_kopeks ?? 0)
                        })}
                    </div>
                </div>
            )}

            {tab === 'traffic' && (
                <div className={classes.coOptions} role="radiogroup">
                    {offer.traffic.map((p) => (
                        <button
                            aria-checked={p.gb === trafficGb}
                            className={classes.coOption}
                            key={p.gb}
                            onClick={() => setTrafficGb(p.gb)}
                            role="radio"
                            type="button"
                        >
                            <span className={classes.coOptionMain}>
                                {p.gb === 0 ? t('coUnlimited') : t('coGb', { n: p.gb })}
                            </span>
                            <span className={classes.coOptionPrice}>{money(p.price_kopeks)}</span>
                        </button>
                    ))}
                </div>
            )}

            <div>
                <div className={classes.coLabel}>{t('coMethod')}</div>
                <div className={classes.coMethods} role="radiogroup">
                    {offer.payment_methods.map((m) => (
                        <button
                            aria-checked={m.id === methodId}
                            className={classes.coMethod}
                            key={m.id}
                            onClick={() => setMethodId(m.id)}
                            role="radio"
                            type="button"
                        >
                            <span className={classes.coOptionMain}>{m.name}</span>
                            {m.description && (
                                <span className={classes.coOptionMeta}>{m.description}</span>
                            )}
                        </button>
                    ))}
                </div>
                {method?.options && method.options.length > 1 && (
                    <div className={classes.coChips} role="radiogroup">
                        {method.options.map((o) => (
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
                )}
            </div>

            {error && (
                <div className={classes.coError} role="alert">
                    <IconAlertCircle aria-hidden size={20} />
                    <span>
                        {t(error)}
                        {errorDetail ? ` (${errorDetail})` : ''}
                    </span>
                </div>
            )}

            <div className={classes.coFooter}>
                <div className={classes.coTotal}>
                    <span>{t('coTotal')}</span>
                    <strong className={classes.num}>{money(price)}</strong>
                </div>
                <button
                    className={clsx(classes.btn, classes.btnPrimary, classes.btnGlow)}
                    disabled={busy || price <= 0 || !method}
                    onClick={submit}
                    type="button"
                >
                    {busy ? <IconLoader2 aria-hidden className={classes.spin} size={20} /> : null}
                    {t('coGetLink')}
                </button>
            </div>
        </div>
    )
}

/* ───────────── step 2: pay ───────────── */

function PaymentStep({ pending, phase }: { pending: IPendingPayment; phase: TPhase | null }) {
    const { t } = useSpofyT()
    const money = useMoney()
    const setPending = useCheckoutStore((s) => s.setPending)
    const [showQr, setShowQr] = useState(false)
    const { result } = pending
    const qrRef = useRef<string>('')

    if (showQr && !qrRef.current) {
        qrRef.current = `data:image/svg+xml;utf8,${encodeURIComponent(
            renderSVG(result.qr_payload || result.payment_url, {
                whiteColor: '#FFFFFF',
                blackColor: '#0B1220'
            })
        )}`
    }

    const done = phase === 'done'
    const rest = result.amount_kopeks - result.price_kopeks

    return (
        <div className={classes.coStack}>
            {!done && (
                <>
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
                    <p className={classes.coHint}>{t('coPayHint')}</p>
                    {rest > 0 && (
                        <p className={classes.coHint}>
                            {t('coMinNote', {
                                amount: money(result.amount_kopeks),
                                rest: money(rest)
                            })}
                        </p>
                    )}
                    <button
                        aria-expanded={showQr}
                        className={clsx(classes.btn, classes.btnSecondary, classes.btnSmall)}
                        onClick={() => setShowQr((v) => !v)}
                        type="button"
                    >
                        <IconQrcode aria-hidden size={18} />
                        {t('coOtherDevice')}
                    </button>
                    {showQr && (
                        <img alt={t('coOtherDevice')} className={classes.qr} src={qrRef.current} />
                    )}
                </>
            )}

            <div
                aria-live="polite"
                className={clsx(classes.coStatus, done && classes.coStatusDone)}
                role="status"
            >
                {done ? (
                    <IconCheck aria-hidden size={20} />
                ) : (
                    <IconLoader2 aria-hidden className={classes.spin} size={20} />
                )}
                <span>
                    {done
                        ? t('coDone')
                        : phase === 'paid'
                          ? t('coPaid')
                          : phase === 'timeout'
                            ? t('coTimeout')
                            : t('coWaiting')}
                </span>
            </div>

            {done ? (
                <button
                    className={clsx(classes.btn, classes.btnPrimary)}
                    onClick={() => {
                        setPending(null)
                        window.location.reload()
                    }}
                    type="button"
                >
                    {t('coRefresh')}
                </button>
            ) : (
                <button
                    className={clsx(classes.btn, classes.btnGhost)}
                    onClick={() => setPending(null)}
                    type="button"
                >
                    <IconArrowLeft aria-hidden size={18} />
                    {t('coBack')}
                </button>
            )}
        </div>
    )
}

/* ───────────── small banner while a payment is pending and the sheet is closed ───────────── */

export function PendingBanner({ phase }: { phase: TPhase | null }) {
    const { opened, pending, open } = useCheckoutStore()
    const subscription = useSubscription()
    const money = useMoney()
    const { t } = useSpofyT()
    if (opened || !pending || pending.shortUuid !== subscription.user.shortUuid || !phase)
        return null

    const done = phase === 'done'
    return (
        <button
            className={clsx(classes.pendingBanner, done && classes.coStatusDone)}
            onClick={() => open('renew')}
            type="button"
        >
            {done ? (
                <IconCheck aria-hidden size={20} />
            ) : (
                <IconLoader2 aria-hidden className={classes.spin} size={20} />
            )}
            <span className={classes.pendingText}>
                {done
                    ? t('coDone')
                    : t('coPendingBanner', { price: money(pending.result.amount_kopeks) })}
            </span>
            <span className={classes.pendingOpen}>{t('coPendingOpen')}</span>
        </button>
    )
}
