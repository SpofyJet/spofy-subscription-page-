import { Drawer, Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
    IconAlertCircle,
    IconArrowLeft,
    IconArrowsUpDown,
    IconBolt,
    IconCalendarCheck,
    IconCheck,
    IconChevronDown,
    IconClock,
    IconCreditCard,
    IconCurrencyBitcoin,
    IconDevices,
    IconExternalLink,
    IconLoader2,
    IconLock,
    IconMessageCircle,
    IconMinus,
    IconPlus,
    IconQrcode,
    IconRefresh,
    IconSparkles,
    IconStar,
    IconWallet
} from '@tabler/icons-react'
import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'

import { vibrate } from '@shared/utils/vibrate'

import { useSubscription } from '@entities/subscription-info-store'

import {
    CheckoutError,
    checkoutApi,
    IOffer,
    IPeriodOption,
    TCheckoutKind,
    track
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
import {
    defaultPeriod,
    discountOf,
    minPerMonth,
    monthsOf,
    offeredTariff,
    perMonthKopeks
} from '../checkout/offer-utils'
import { markPayOpened, TPhase } from '../checkout/pending'
import {
    countOf,
    formatBytes,
    formatDateNumeric,
    formatDayMonth,
    formatDays,
    formatPeriod,
    isForeverDays,
    isIndefinite,
    toNumber
} from '../format'
import { TSpofyKey, useSpofyT } from '../i18n'
import { useBackToClose, useSwipeToClose } from '../overlay'
import { useQrDataUrl } from '../qr'
import { useSpofyData } from '../spofy-store'
import classes from '../spofy.module.css'

const DAY_MS = 86_400_000
const GIB = 1024 ** 3

/* ───────────── sheet ───────────── */

const TAB_ICON: Record<TCheckoutTab, typeof IconRefresh> = {
    renew: IconRefresh,
    devices: IconDevices,
    traffic: IconArrowsUpDown
}

export default function CheckoutSheet({
    phase,
    renewUrl,
    supportUrl
}: {
    phase: TPhase | null
    renewUrl: null | string
    supportUrl: null | string
}) {
    const { opened, close, pending, showPending, tab, offer, offerError, loadOffer } =
        useCheckoutStore()
    const subscription = useSubscription()
    const shortUuid = subscription.user.shortUuid
    const isDesktop = useMediaQuery('(min-width: 48em)')
    const { t, lang } = useSpofyT()
    const bypassOff = useSpofyData().bypassDisabled
    // a phone: «Назад» closes the window, and so does pulling it down by the top
    const titleRef = useRef<HTMLSpanElement>(null)
    useBackToClose(opened, close)
    useSwipeToClose(titleRef, opened && !isDesktop, close)

    useEffect(() => {
        if (opened) loadOffer(shortUuid)
    }, [opened, shortUuid, loadOffer])

    useEffect(() => {
        if (opened) track(shortUuid, 'sheet_open', { t: tab })
    }, [opened])

    const ownPending = !!pending && pending.shortUuid === shortUuid
    // The invoice is shown when it was asked for (banner, «Открыть счёт», just created) — or once
    // its money has arrived: then nothing else may be bought until it is applied.
    const showPayment =
        ownPending && (showPending || phase === 'paid' || phase === 'done' || phase === 'expired')
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
    const Icon = showPayment ? IconWallet : trial && tab === 'renew' ? IconSparkles : TAB_ICON[tab]
    // What the person gets, not how payment works; urgency only when it is true.
    const daysLeft = subscription.user.daysLeft
    const ending =
        !showPayment &&
        tab === 'renew' &&
        !trial &&
        !isIndefinite(subscription.user.expiresAt) &&
        new Date(subscription.user.expiresAt).getTime() > Date.now() &&
        daysLeft >= 0 &&
        daysLeft <= 3
    const expired =
        tab === 'renew' &&
        !trial &&
        (subscription.user.userStatus === 'EXPIRED' ||
            (!isIndefinite(subscription.user.expiresAt) &&
                new Date(subscription.user.expiresAt).getTime() <= Date.now()))
    const subtitle = showPayment
        ? phase === 'done'
            ? t('coDoneSub')
            : phase === 'paid'
              ? t('coPaid')
              : t('coSub')
        : expired
          ? t('coSubExpired')
          : ending
            ? daysLeft === 0
                ? t('coSubEndsToday')
                : t('coSubEnding', { n: daysLeft, days: formatDays(daysLeft, lang) })
            : t(
                  tab === 'devices'
                      ? 'coSubDevices'
                      : tab === 'traffic'
                        ? bypassOff
                            ? 'coSubTraffic'
                            : 'coSubTrafficAdd'
                        : trial
                          ? 'coSubTariff'
                          : isIndefinite(subscription.user.expiresAt)
                            ? 'coSubRenewPlain'
                            : 'coSubRenew',
                  tab === 'renew'
                      ? { date: formatDateNumeric(subscription.user.expiresAt, lang) }
                      : undefined
              )

    const title = (
        <span className={classes.coTitle} ref={titleRef}>
            <span
                aria-hidden
                className={classes.coTitleIcon}
                data-tone={showPayment ? 'ok' : trial && tab === 'renew' ? 'trial' : tab}
            >
                <Icon size={20} stroke={2} />
            </span>
            <span className={classes.coTitleText}>
                <span>{t(titleKey)}</span>
                <span className={clsx(classes.coTitleSub, ending && classes.coTitleSubWarn)}>
                    {subtitle}
                </span>
            </span>
        </span>
    )

    const body = showPayment ? (
        <PaymentStep pending={pending!} phase={phase} supportUrl={supportUrl} />
    ) : offerError ? (
        <ErrorBox
            errorKey={offerError}
            onRetry={offerError === 'coErrNotInBot' ? undefined : () => loadOffer(shortUuid, true)}
            renewUrl={renewUrl}
        />
    ) : offer ? (
        <>
            {ownPending && <PendingNotice pending={pending!} />}
            <Chooser offer={offer} renewUrl={renewUrl} />
        </>
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
        transitionProps: { duration: 200 }
    }

    return isDesktop ? (
        <Modal {...common} centered radius="lg" size={480}>
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
            {[0, 1, 2].map((i) => (
                <div className={clsx(classes.skel, classes.skelRow)} key={i} />
            ))}
            <div className={clsx(classes.skel, classes.skelBtn)} />
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

/* ───────────── payment methods ───────────── */

/** The bot decorates names with emoji («💳 Карта»); the page has its own icons. */
const plain = (text: null | string | undefined) =>
    (text ?? '')
        .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}️‍⃣]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim()

/** Short label: «Криптовалюта Heleket» → «Heleket» (the icon already says «crypto»). */
const choiceLabel = (name: string) => {
    const full = plain(name)
    const short = full
        .replace(/криптовалют\p{L}*/giu, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    return short || full
}

type TMethodKind = 'card' | 'crypto' | 'other' | 'sbp' | 'stars'

const METHOD_ICON: Record<TMethodKind, typeof IconWallet> = {
    card: IconCreditCard,
    sbp: IconBolt,
    crypto: IconCurrencyBitcoin,
    stars: IconStar,
    other: IconWallet
}

function methodKind(m: IOffer['payment_methods'][number]): TMethodKind {
    const id = m.id.toLowerCase()
    const optionIds = (m.options ?? []).map((o) => o.id.toLowerCase())
    if (/heleket|crypt|ton|usdt|bitcoin|cashera/.test(id)) return 'crypto'
    if (id.includes('star')) return 'stars'
    if (optionIds.includes('sbp') && !optionIds.some((o) => o.includes('card'))) return 'sbp'
    if (id.includes('sbp')) return 'sbp'
    if (
        optionIds.some((o) => o.includes('card') || o === 'sbp') ||
        /card|yookassa|pal24|platega|wata|mulen|freekassa|cloudpayments|tribute/.test(id)
    )
        return 'card'
    return 'other'
}

/** Methods shown up front: the first card/SBP one and Heleket (crypto). The rest sit behind «Другой способ». */
function primaryMethods(all: IOffer['payment_methods']): string[] {
    // A method that just failed to create payments is not offered up front (it stays under
    // «Другой способ оплаты», marked). If everything is down, offer everything.
    const live = all.filter((m) => !m.down)
    const methods = live.length ? live : all
    const card = methods.find((m) => methodKind(m) === 'card' || methodKind(m) === 'sbp')
    const crypto =
        methods.find((m) => m.id.toLowerCase().includes('heleket')) ??
        methods.find((m) => methodKind(m) === 'crypto')
    const ids = [card?.id, crypto?.id].filter((x): x is string => !!x)
    return ids.length ? ids : methods.slice(0, 1).map((m) => m.id)
}

/* ───────────── step 1: what to buy · step 2: how to pay ───────────── */

/** Whole rubles, rounded down: a saving is never promised bigger than it is. */
const wholeRubles = (kopeks: number) => Math.floor(kopeks / 100) * 100

function Chooser({ offer, renewUrl }: { offer: IOffer; renewUrl: null | string }) {
    const { t, lang } = useSpofyT()
    const money = useMoney()
    const subscription = useSubscription()
    const { tab: wantedTab, setTab, setPending, preset } = useCheckoutStore()
    const [stage, setStage] = useState<'choose' | 'method'>('choose')
    const top = useRef<HTMLDivElement>(null)

    const isTrial = offer.subscription.is_trial
    const canRenew = offer.renewal.length > 0
    const canTariff = offer.tariffs.length > 0
    const canDevices = !!offer.devices.available && (offer.devices.can_add ?? 1) > 0
    const canTraffic = offer.traffic.length > 0

    // A trial has one thing to buy — a plan. Extra devices and traffic come with it, so their
    // tabs are not shown at all (no dead ends).
    const tabs = (
        [
            ['renew', isTrial || !canRenew ? 'coTabTariff' : 'coTabRenew', canRenew || canTariff],
            ['devices', 'coTabDevices', canDevices && !isTrial],
            ['traffic', 'coTabTraffic', canTraffic && !isTrial]
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
            defaultPeriod(offer.renewal)?.period_days ??
            null
    )
    const [tariffId, setTariffId] = useState<number | null>(
        () =>
            (preset?.tariffId && offer.tariffs.some((x) => x.id === preset.tariffId)
                ? preset.tariffId
                : null) ??
            offeredTariff(offer.tariffs)?.id ??
            null
    )
    const tariff = offer.tariffs.find((x) => x.id === tariffId) ?? offeredTariff(offer.tariffs)
    const [tariffPeriod, setTariffPeriod] = useState<number | null>(
        () =>
            (preset?.periodDays && tariff?.periods.some((p) => p.period_days === preset.periodDays)
                ? preset.periodDays
                : null) ??
            (tariff ? defaultPeriod(tariff.periods)?.period_days : null) ??
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
    /** devices to ADD — the number on the stepper; every tap changes it by exactly one */
    const [devices, setDevices] = useState(1)
    const [trafficGb, setTrafficGb] = useState<number | null>(() =>
        preset?.trafficGb !== undefined && offer.traffic.some((p) => p.gb === preset.trafficGb)
            ? preset.trafficGb
            : (offer.traffic[0]?.gb ?? null)
    )
    const primary = primaryMethods(offer.payment_methods)
    // Default: card / SBP. A method remembered from an earlier payment wins only if it is one of
    // the up-front choices.
    const [methodId, setMethodId] = useState<string | null>(() => {
        const saved = loadMethod()
        return saved && primary.includes(saved)
            ? saved
            : (primary[0] ?? offer.payment_methods[0]?.id ?? null)
    })
    const method = offer.payment_methods.find((m) => m.id === methodId)
    const [optionId, setOptionId] = useState<null | string>(method?.options?.[0]?.id ?? null)
    const [allMethods, setAllMethods] = useState(false)
    const [tariffsOpen, setTariffsOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<TSpofyKey | null>(null)
    const [errorDetail, setErrorDetail] = useState<null | string>(null)

    useEffect(() => {
        setOptionId((current) =>
            method?.options?.some((o) => o.id === current)
                ? current
                : (method?.options?.[0]?.id ?? null)
        )
    }, [methodId])

    // New step or tab: start reading from the top of the sheet — but on a small phone the
    // preselected period must not hide under the button: bring it into view.
    useEffect(() => {
        const scroller = top.current?.closest<HTMLElement>(
            '[class*="mantine-Drawer-content"], [class*="mantine-Modal-content"]'
        )
        scroller?.scrollTo({ top: 0 })
        if (stage !== 'choose') return
        const id = window.setTimeout(() => {
            const chosen = top.current?.querySelectorAll<HTMLElement>(
                '[role="radio"][aria-checked="true"]'
            )
            const row = chosen?.[chosen.length - 1]
            if (!scroller || !row) return
            // lift the chosen row just above the sticky footer (its saving line + button)
            const footer = scroller.querySelector<HTMLElement>(`.${classes.coFooter}`)
            const visibleBottom =
                scroller.getBoundingClientRect().bottom -
                (footer?.getBoundingClientRect().height ?? 0) -
                12
            const overflow = row.getBoundingClientRect().bottom - visibleBottom
            if (overflow > 0)
                scroller.scrollTo({ top: scroller.scrollTop + overflow, behavior: 'smooth' })
        }, 260)
        return () => window.clearTimeout(id)
    }, [stage, tab])

    const deviceQuote = deviceQuotes.find((q) => q.devices === devices)
    const deviceFree = tab === 'devices' && !!deviceQuote && deviceQuote.total_price_kopeks === 0

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

    // Savings in rubles against paying month by month, and the best per-month period.
    const periodOptions = tariffMode ? (tariff?.periods ?? []) : offer.renewal
    const monthly = periodOptions.find((o) => o.period_days === 30)
    const savingOf = (o: IPeriodOption | undefined) => {
        if (!o) return 0
        // «навсегда» is not compared with paying monthly: that «saving» would be made up
        if (isForeverDays(o.period_days)) return 0
        if (monthly && o.period_days > 31) {
            return wholeRubles(
                Math.max(0, monthly.price_kopeks * monthsOf(o.period_days) - o.price_kopeks)
            )
        }
        return wholeRubles(
            o.original_price_kopeks ? Math.max(0, o.original_price_kopeks - o.price_kopeks) : 0
        )
    }
    // one badge: «Рекомендуем» on the period the bot stars, else 3 months (owner's decision)
    const recommended = periodOptions.length > 1 ? defaultPeriod(periodOptions)?.period_days : null
    const saving = tab === 'renew' ? savingOf(selectedPeriod) : 0

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
    // Only for a plain renewal: when a new plan starts is the bot's business, not a guess here.
    const newEnd =
        tab === 'renew' && !tariffMode && period && !isIndefinite(new Date(currentEnd))
            ? Math.max(currentEnd, Date.now()) + period * DAY_MS
            : null

    const currentDevices = offer.devices.current_device_limit ?? offer.subscription.device_limit
    const currentGb = offer.subscription.traffic_limit_gb
    // left to use right now, from the panel (the bot only knows the limit)
    const panelLimit = toNumber(subscription.user.trafficLimitBytes)
    const trafficLeftBytes = Math.max(
        0,
        (panelLimit > 0 ? panelLimit : currentGb * GIB) -
            toNumber(subscription.user.trafficUsedBytes)
    )
    const limited = subscription.user.userStatus === 'LIMITED'
    // Cheapest gigabyte among sized packages (only when there is something to compare).
    const sized = offer.traffic.filter((p) => p.gb > 0 && p.price_kopeks > 0)
    const perGb = (p: { gb: number; price_kopeks: number }) => p.price_kopeks / p.gb
    const cheapestGb = sized.reduce<(typeof sized)[number] | null>(
        (top, p) => (!top || perGb(p) < perGb(top) ? p : top),
        null
    )
    const bestGb =
        cheapestGb && sized.length > 1 && sized.some((p) => perGb(p) > perGb(cheapestGb) * 1.05)
            ? cheapestGb.gb
            : null
    const trafficLabel = (gb: number) => (gb === 0 ? t('coUnlimited') : t('coGb', { n: gb }))

    const summary = (): string => {
        if (tab === 'devices') return t('coSummaryDevices', { n: countOf(devices, lang, 'device') })
        if (tab === 'traffic') return t('coSummaryTraffic', { gb: trafficLabel(trafficGb ?? 0) })
        const days = selectedPeriod?.period_days ?? 0
        const p = formatPeriod(days, lang)
        if (isForeverDays(days)) {
            const name = tariffMode && tariff ? tariff.name : offer.subscription.tariff_name
            return name ? t('coSummaryForever', { name }) : t('periodForever')
        }
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
        track(subscription.user.shortUuid, 'pay_click', { t: tab, k: methodKind(method) })
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
            let key = errorKey(err)
            if (key === 'coErrMethodDown') {
                // One provider failed: choose another one for the person, so the next tap pays.
                const others = offer.payment_methods.filter((m) => m.id !== method.id && !m.down)
                const next = others.find((m) => primary.includes(m.id)) ?? others[0]
                setAllMethods(true)
                if (next) {
                    setMethodId(next.id)
                    setOptionId(next.options?.[0]?.id ?? null)
                    key = 'coErrMethodSwitched'
                }
            }
            setError(key)
            setErrorDetail(
                err instanceof CheckoutError && !KNOWN_ERROR_KEYS.includes(key) ? err.detail : null
            )
        } finally {
            setBusy(false)
        }
    }

    /**
     * One tap to the payment page. Browsers let a tap open a tab, but not a later answer from the
     * server — so the tab is opened right in the tap, the invoice is created as before (`submit`,
     * unchanged), and then the tab goes to it. Where no tab can be opened (some in-app browsers),
     * the waiting screen keeps its «Перейти к оплате» button.
     */
    const payAndOpen = async () => {
        let tab: null | Window = null
        try {
            tab = window.open('', '_blank')
            if (tab) {
                tab.opener = null
                tab.document.write(
                    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spofy VPN</title><p style="font:17px system-ui,sans-serif;padding:32px 24px;color:#5b6475">${t('coOpening')}</p>`
                )
                tab.document.close()
            }
        } catch {
            tab = null
        }
        const before = useCheckoutStore.getState().pending
        await submit()
        const created = useCheckoutStore.getState().pending
        if (!tab) return
        if (created && created !== before && created.result.payment_url) {
            try {
                tab.location.href = created.result.payment_url
                autoOpened.add(created.result.payment_id)
                markPayOpened(created.result.payment_id)
                track(created.shortUuid, 'pay_open', {
                    t:
                        created.kind === 'devices' || created.kind === 'traffic'
                            ? created.kind
                            : 'renew'
                })
            } catch {
                tab.close()
            }
        } else {
            tab.close()
        }
    }

    const radio = <span aria-hidden className={classes.optRadio} />

    const periodList = (
        options: IPeriodOption[],
        value: number | null,
        onChange: (v: number) => void
    ) => {
        const sorted = [...options].sort((a, b) => a.period_days - b.period_days)
        return (
            <div aria-label={t('coChoosePeriod')} className={classes.optList} role="radiogroup">
                {sorted.map((option) => {
                    const months = monthsOf(option.period_days)
                    const optionSaving = savingOf(option)
                    const isRecommended = option.period_days === recommended
                    const strike =
                        option.original_price_kopeks &&
                        option.original_price_kopeks > option.price_kopeks
                            ? option.original_price_kopeks
                            : null
                    const discount = discountOf(option)
                    return (
                        <button
                            aria-checked={option.period_days === value}
                            className={classes.opt}
                            data-recommended={isRecommended || undefined}
                            key={option.period_days}
                            onClick={() => {
                                vibrate('tap')
                                onChange(option.period_days)
                            }}
                            role="radio"
                            type="button"
                        >
                            {radio}
                            <span className={classes.optMain}>
                                <span className={classes.optTitle}>
                                    {formatPeriod(option.period_days, lang)}
                                    {isRecommended && (
                                        <span className={classes.badgeRecommended}>
                                            {t('coRecommended')}
                                        </span>
                                    )}
                                </span>
                                {isForeverDays(option.period_days) ? (
                                    <span className={classes.optMeta}>{t('coForeverMeta')}</span>
                                ) : (
                                    option.period_days >= 28 && (
                                        <span className={clsx(classes.optMeta, classes.num)}>
                                            {/* the bot adds days: «3 месяца» are 90 of them */}
                                            <span>{countOf(option.period_days, lang, 'day')}</span>
                                            {months >= 2 && (
                                                <span>
                                                    {t('perMonthShort', {
                                                        price: money(perMonthKopeks(option))
                                                    })}
                                                </span>
                                            )}
                                            {optionSaving > 0 ? (
                                                <span className={classes.saving}>
                                                    {t('coRowSaving', {
                                                        saving: money(optionSaving)
                                                    })}
                                                </span>
                                            ) : discount > 0 ? (
                                                <span className={classes.saving}>−{discount}%</span>
                                            ) : null}
                                        </span>
                                    )
                                )}
                            </span>
                            <span className={clsx(classes.optPrice, classes.num)}>
                                <strong>{money(option.price_kopeks)}</strong>
                                {strike && <s>{money(strike)}</s>}
                            </span>
                        </button>
                    )
                })}
            </div>
        )
    }

    /* ── step 2: how to pay ── */
    if (stage === 'method') {
        const choices = offer.payment_methods
            .filter((m) => primary.includes(m.id))
            .flatMap((m) => {
                const options = m.options && m.options.length > 1 ? m.options : null
                return (options ?? [null]).map((o) => ({ m, o }))
            })
        const others = offer.payment_methods.filter((m) => !primary.includes(m.id))
        const downNote = offer.payment_methods
            .filter((m) => m.down && primary.every((id) => id !== m.id))
            .slice(0, 1)

        return (
            <div className={classes.coStack} ref={top}>
                <button
                    className={classes.coBack}
                    onClick={() => {
                        setStage('choose')
                        setError(null)
                    }}
                    type="button"
                >
                    <IconArrowLeft aria-hidden size={18} stroke={2.2} />
                    {t('coBackShort')}
                </button>

                <div className={classes.coOrder}>
                    <span className={classes.coRowText}>
                        <span className={classes.coRowMeta}>{t('coPayFor')}</span>
                        <span className={classes.coRowTitle}>{summary()}</span>
                        {newEnd && (
                            <span className={clsx(classes.coRowMeta, classes.num)}>
                                {t('coRenewUntil', {
                                    date: formatDayMonth(new Date(newEnd), lang)
                                })}
                            </span>
                        )}
                    </span>
                    <span className={clsx(classes.optPrice, classes.num)}>
                        <strong className={classes.coOrderPrice}>{money(price)}</strong>
                        {original && <s>{money(original)}</s>}
                    </span>
                </div>

                <div className={classes.coSection}>
                    <h3 className={classes.coLabel}>{t('coMethod')}</h3>
                    <div aria-label={t('coMethod')} className={classes.optList} role="radiogroup">
                        {choices.map(({ m, o }) => {
                            const kind: TMethodKind = o
                                ? o.id.toLowerCase().includes('sbp')
                                    ? 'sbp'
                                    : 'card'
                                : methodKind(m)
                            const ChoiceIcon = METHOD_ICON[kind]
                            const checked = m.id === methodId && (!o || o.id === optionId)
                            const name =
                                kind === 'crypto' ? t('coCrypto') : choiceLabel(o ? o.name : m.name)
                            const about = o ? plain(o.description) : plain(m.description)
                            return (
                                <button
                                    aria-checked={checked}
                                    className={classes.opt}
                                    key={`${m.id}:${o?.id ?? ''}`}
                                    onClick={() => {
                                        vibrate('tap')
                                        setMethodId(m.id)
                                        setOptionId(o?.id ?? m.options?.[0]?.id ?? null)
                                    }}
                                    role="radio"
                                    type="button"
                                >
                                    {radio}
                                    <span
                                        aria-hidden
                                        className={classes.methodIcon}
                                        data-kind={kind}
                                    >
                                        <ChoiceIcon size={20} stroke={1.9} />
                                    </span>
                                    <span className={classes.optMain}>
                                        <span className={classes.optTitle}>{name}</span>
                                        {about && kind !== 'card' && kind !== 'sbp' && (
                                            <span className={classes.optMeta}>{about}</span>
                                        )}
                                    </span>
                                </button>
                            )
                        })}
                        {allMethods &&
                            others.map((m) => {
                                const kind = methodKind(m)
                                const MethodIcon = METHOD_ICON[kind]
                                return (
                                    <button
                                        aria-checked={m.id === methodId}
                                        className={classes.opt}
                                        key={m.id}
                                        onClick={() => {
                                            vibrate('tap')
                                            setMethodId(m.id)
                                            setOptionId(m.options?.[0]?.id ?? null)
                                        }}
                                        role="radio"
                                        type="button"
                                    >
                                        {radio}
                                        <span
                                            aria-hidden
                                            className={classes.methodIcon}
                                            data-kind={kind}
                                        >
                                            <MethodIcon size={20} stroke={1.9} />
                                        </span>
                                        <span className={classes.optMain}>
                                            <span className={classes.optTitle}>
                                                {plain(m.name)}
                                            </span>
                                            {(m.down || plain(m.description)) && (
                                                <span
                                                    className={clsx(
                                                        classes.optMeta,
                                                        m.down && classes.optMetaWarn
                                                    )}
                                                >
                                                    {m.down
                                                        ? t('coDownShort')
                                                        : plain(m.description)}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                )
                            })}
                    </div>
                    {downNote.map((m) => (
                        <p className={classes.coHint} key={`down-${m.id}`}>
                            {t('coMethodDownNote', { name: choiceLabel(m.name) })}
                        </p>
                    ))}
                    {others.length > 0 && (
                        <button
                            aria-expanded={allMethods}
                            className={classes.coMore}
                            onClick={() => setAllMethods((v) => !v)}
                            type="button"
                        >
                            {allMethods ? t('coMethodLess') : t('coMethodMore')}
                            <IconChevronDown
                                aria-hidden
                                className={clsx(classes.chevron, allMethods && classes.chevronOpen)}
                                size={16}
                                stroke={2.25}
                            />
                        </button>
                    )}
                </div>

                {error && <ErrorBox detail={errorDetail} errorKey={error} renewUrl={renewUrl} />}

                <div className={classes.coFooter}>
                    <button
                        className={clsx(
                            classes.btn,
                            classes.btnPrimary,
                            classes.btnGlow,
                            classes.coPayBtn
                        )}
                        disabled={busy || price <= 0 || !method}
                        onClick={() => void payAndOpen()}
                        type="button"
                    >
                        <span className={classes.btnLabel}>
                            {busy ? (
                                <IconLoader2 aria-hidden className={classes.spin} size={20} />
                            ) : (
                                <IconLock aria-hidden size={18} stroke={2.25} />
                            )}
                            {t('coPay', { price: money(price) })}
                        </span>
                    </button>
                    <span className={classes.coSecure}>{t('coSecure')}</span>
                </div>
            </div>
        )
    }

    /* ── step 1: what to buy ── */
    return (
        <div className={classes.coStack} ref={top}>
            {tab === 'renew' && !tariffMode && periodList(offer.renewal, period, setPeriod)}

            {tab === 'renew' && tariffMode && tariff && (
                <>
                    {/* One plan is offered; the others wait behind «Сменить». */}
                    {offer.tariffs.length > 1 && !tariffsOpen && (
                        <button
                            aria-expanded={false}
                            className={classes.tariffPicked}
                            onClick={() => setTariffsOpen(true)}
                            type="button"
                        >
                            <span className={classes.optMain}>
                                <span className={classes.optTitle}>{tariff.name}</span>
                                {(tariff.description ?? '').trim() && (
                                    <span className={classes.optMeta}>
                                        {tariff.description!.trim()}
                                    </span>
                                )}
                            </span>
                            <span className={classes.tariffChange}>
                                {t('coChangeTariff')}
                                <IconChevronDown aria-hidden size={16} stroke={2.25} />
                            </span>
                        </button>
                    )}
                    {offer.tariffs.length > 1 && tariffsOpen && (
                        <div
                            aria-label={t('coChooseTariff')}
                            className={classes.optList}
                            role="radiogroup"
                        >
                            {offer.tariffs.map((x) => {
                                const about = (x.description ?? '').trim()
                                // a plan paid by the month shows «от N ₽/мес»; a «навсегда» plan
                                // (ULTIMA) has no monthly price — its one price and «навсегда»
                                const xFrom = minPerMonth(x.periods)
                                const forever = x.periods.filter(
                                    (p) => p.price_kopeks > 0 && isForeverDays(p.period_days)
                                )
                                const xForever = forever.length
                                    ? Math.min(...forever.map((p) => p.price_kopeks))
                                    : null
                                return (
                                    <button
                                        aria-checked={x.id === tariff.id}
                                        className={classes.opt}
                                        key={x.id}
                                        onClick={() => {
                                            vibrate('tap')
                                            setTariffId(x.id)
                                            setTariffsOpen(false)
                                            setTariffPeriod(
                                                (
                                                    x.periods.find(
                                                        (p) => p.period_days === tariffPeriod
                                                    ) ?? defaultPeriod(x.periods)
                                                )?.period_days ?? null
                                            )
                                        }}
                                        role="radio"
                                        type="button"
                                    >
                                        {radio}
                                        <span className={classes.optMain}>
                                            <span className={classes.optTitle}>{x.name}</span>
                                            {about && (
                                                <span className={classes.optMeta}>{about}</span>
                                            )}
                                        </span>
                                        {xFrom !== null ? (
                                            <span className={clsx(classes.optPrice, classes.num)}>
                                                <span className={classes.optFrom}>
                                                    {t('ctaFromMonth', { price: money(xFrom) })}
                                                </span>
                                            </span>
                                        ) : xForever !== null ? (
                                            <span className={clsx(classes.optPrice, classes.num)}>
                                                <span className={classes.optFrom}>
                                                    <span className={classes.optFromTotal}>
                                                        {money(xForever)}
                                                    </span>
                                                    {t('priceForever')}
                                                </span>
                                            </span>
                                        ) : null}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    {periodList(tariff.periods, tariffPeriod, setTariffPeriod)}
                </>
            )}

            {tab === 'devices' && (
                <div className={classes.coDevices}>
                    <span className={classes.coLabel}>{t('coDevicesAddLabel')}</span>
                    <div className={classes.coStepper}>
                        <button
                            aria-label="−1"
                            className={classes.coStepBtn}
                            disabled={devices <= 1}
                            onClick={() => {
                                vibrate('selection')
                                setDevices((n) => Math.max(1, n - 1))
                            }}
                            type="button"
                        >
                            <IconMinus aria-hidden size={22} stroke={2.2} />
                        </button>
                        <output
                            aria-live="polite"
                            className={clsx(classes.coStepValue, classes.num)}
                        >
                            +{devices}
                        </output>
                        <button
                            aria-label="+1"
                            className={classes.coStepBtn}
                            disabled={devices >= maxAdd}
                            onClick={() => {
                                vibrate('selection')
                                setDevices((n) => Math.min(maxAdd, n + 1))
                            }}
                            type="button"
                        >
                            <IconPlus aria-hidden size={22} stroke={2.2} />
                        </button>
                    </div>
                    <span className={clsx(classes.coWillBe, classes.num)}>
                        {t('coDevicesWillBe', {
                            total: countOf(currentDevices + devices, lang, 'device'),
                            now: currentDevices
                        })}
                    </span>
                    {offer.devices.base_device_price_kopeks ? (
                        <span className={classes.coHint}>
                            {t('coDeviceBase', {
                                price: money(offer.devices.base_device_price_kopeks)
                            })}
                            {offer.devices.days_left
                                ? `, ${t('coDeviceProrated', { n: offer.devices.days_left, days: formatDays(offer.devices.days_left, lang) })}`
                                : ''}
                        </span>
                    ) : null}
                    {deviceFree && <span className={classes.saving}>{t('coDeviceFree')}</span>}
                </div>
            )}

            {tab === 'traffic' && (
                <>
                    <p className={classes.coHint}>
                        {limited ? t('coTrafficWhatLimited') : t('coTrafficWhat')}
                    </p>
                    <div
                        aria-label={t('coTabTraffic')}
                        className={classes.optList}
                        role="radiogroup"
                    >
                        {offer.traffic.map((p) => (
                            <button
                                aria-checked={p.gb === trafficGb}
                                className={classes.opt}
                                data-best={p.gb === bestGb || undefined}
                                key={p.gb}
                                onClick={() => {
                                    vibrate('tap')
                                    setTrafficGb(p.gb)
                                }}
                                role="radio"
                                type="button"
                            >
                                {radio}
                                <span className={classes.optMain}>
                                    <span className={classes.optTitle}>
                                        {trafficLabel(p.gb)}
                                        {p.gb === bestGb && (
                                            <span className={classes.badgeBest}>
                                                {t('coBestGb')}
                                            </span>
                                        )}
                                    </span>
                                    {p.gb > 0 && (
                                        <span className={clsx(classes.optMeta, classes.num)}>
                                            <span>
                                                {t('coPerGb', {
                                                    price: money(Math.round(p.price_kopeks / p.gb))
                                                })}
                                            </span>
                                            {p.discount_percent ? (
                                                <span className={classes.saving}>
                                                    −{p.discount_percent}%
                                                </span>
                                            ) : null}
                                        </span>
                                    )}
                                </span>
                                <span className={clsx(classes.optPrice, classes.num)}>
                                    <strong>{money(p.price_kopeks)}</strong>
                                </span>
                            </button>
                        ))}
                    </div>
                    {trafficGb !== null && (panelLimit > 0 || currentGb > 0) && (
                        <span className={clsx(classes.coWillBe, classes.num)}>
                            {/* what the person can actually use afterwards, not the new limit */}
                            {t('coTrafficAfter', {
                                gb:
                                    trafficGb === 0
                                        ? t('coUnlimited')
                                        : formatBytes(trafficLeftBytes + trafficGb * GIB, lang)
                            })}
                        </span>
                    )}
                </>
            )}

            {newEnd && (
                <p className={clsx(classes.coUntil, classes.num)}>
                    <IconCalendarCheck aria-hidden size={18} stroke={2} />
                    {t('coRenewUntil', { date: formatDayMonth(new Date(newEnd), lang) })}
                </p>
            )}

            <div className={classes.coFooter}>
                {saving > 0 && (
                    <span className={clsx(classes.coSaving, classes.num)}>
                        {t('coSavingLine', { saving: money(saving) })}
                    </span>
                )}
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
                            classes.btnSplit,
                            classes.coPayBtn
                        )}
                        disabled={price <= 0}
                        onClick={() => {
                            vibrate('tap')
                            setError(null)
                            setStage('method')
                        }}
                        type="button"
                    >
                        <span className={classes.btnLabel}>{t('coContinue')}</span>
                        <span className={clsx(classes.btnPrice, classes.num)}>
                            {original && <s>{money(original)}</s>}
                            {money(price)}
                        </span>
                    </button>
                )}
            </div>
        </div>
    )
}

/* ───────────── step 3: pay and wait ───────────── */

/** Payments whose page this tab opened by itself (so the button only offers to open it again). */
const autoOpened = new Set<string>()

/**
 * An unpaid invoice above the choice: it can be opened, or a new purchase made instead. The bot
 * keeps one cart per person, so a new invoice replaces the old one — say plainly not to pay it.
 */
function PendingNotice({ pending }: { pending: IPendingPayment }) {
    const { t } = useSpofyT()
    const money = useMoney()
    const openPayment = useCheckoutStore((s) => s.openPayment)
    return (
        <div className={classes.coPendingNotice} role="status">
            <IconClock aria-hidden size={20} stroke={2} />
            <div className={classes.coPendingNoticeText}>
                <strong>
                    {t('coPendingNotice', {
                        summary: pending.summary ?? t('coTotal'),
                        price: money(pending.result.amount_kopeks)
                    })}
                </strong>
                <span>{t('coPendingNoticeNew')}</span>
                <button
                    className={clsx(classes.btn, classes.btnSecondary, classes.btnSmall)}
                    onClick={() => {
                        vibrate('tap')
                        openPayment()
                    }}
                    type="button"
                >
                    {t('coPendingNoticeOpen')}
                </button>
            </div>
        </div>
    )
}

/** After this long without «оплачено», offer support with the payment number. */
const STUCK_MS = 75_000

function PaymentStep({
    pending,
    phase,
    supportUrl
}: {
    pending: IPendingPayment
    phase: TPhase | null
    supportUrl: null | string
}) {
    const { t, lang } = useSpofyT()
    const money = useMoney()
    const { setPending, setShowPending, close, latest } = useCheckoutStore()
    const [showQr, setShowQr] = useState(false)
    const { result } = pending
    const qrSrc = useQrDataUrl(showQr ? result.qr_payload || result.payment_url : null)

    const done = phase === 'done'
    const paid = done || phase === 'paid'
    const opened = autoOpened.has(result.payment_id)
    const [stuck, setStuck] = useState(() => Date.now() - pending.createdAt > STUCK_MS)
    useEffect(() => {
        if (stuck) return
        const id = window.setTimeout(
            () => setStuck(true),
            Math.max(0, pending.createdAt + STUCK_MS - Date.now())
        )
        return () => window.clearTimeout(id)
    }, [pending.createdAt, stuck])
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
                        {t('coDoneUntil', { date: formatDayMonth(end, lang) })}
                    </span>
                )}
                <span className={classes.coHint}>{t('coDoneNothing')}</span>
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

    if (phase === 'expired') {
        // The page session died mid-poll; a reload gets a fresh cookie and keeps watching
        // the same payment (the pending entry survives).
        return (
            <div className={clsx(classes.coStack, classes.coSuccess)} role="status">
                <span
                    aria-hidden
                    className={clsx(classes.coSuccessIcon, classes.coSuccessIconWarn)}
                >
                    <IconAlertCircle size={34} stroke={2.5} />
                </span>
                <strong className={classes.coSuccessTitle}>{t('coSessionExpired')}</strong>
                <button
                    className={clsx(classes.btn, classes.btnPrimary, classes.coPayBtn)}
                    onClick={() => window.location.reload()}
                    type="button"
                >
                    {t('coReload')}
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
                    <span className={classes.coRowMeta}>{t('coPayFor')}</span>
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
                    <li className={classes.coStep} data-state={step.state} key={step.key}>
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
                      : opened
                        ? t('coPayOpened')
                        : t('coPayHint')}
            </p>

            {!paid && (
                <a
                    className={clsx(
                        classes.btn,
                        // already opened by the tap on «Оплатить»: offered again, but quietly
                        opened ? classes.btnSecondary : clsx(classes.btnPrimary, classes.btnGlow),
                        classes.coPayBtn
                    )}
                    href={result.payment_url}
                    onClick={() => {
                        vibrate('tap')
                        markPayOpened(result.payment_id)
                        track(pending.shortUuid, 'pay_open', {
                            t:
                                pending.kind === 'devices'
                                    ? 'devices'
                                    : pending.kind === 'traffic'
                                      ? 'traffic'
                                      : 'renew'
                        })
                    }}
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    {t('coGoPay', { price: money(result.amount_kopeks) })}
                    <IconExternalLink aria-hidden size={18} />
                </a>
            )}

            {stuck && !paid && (
                <div className={classes.coStuck} role="status">
                    <strong>{t('coStuck')}</strong>
                    <p className={classes.num}>{t('coStuckText', { id: result.payment_id })}</p>
                    {supportUrl && (
                        <a
                            className={clsx(classes.btn, classes.btnSecondary, classes.btnSmall)}
                            href={supportUrl}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            <IconMessageCircle aria-hidden size={18} stroke={2} />
                            {t('writeSupport')}
                        </a>
                    )}
                </div>
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
                {/* once the money is in, going back to the choice would only invite paying twice */}
                {!paid && (
                    <button
                        className={clsx(classes.btn, classes.btnGhost, classes.btnSmall)}
                        onClick={() => {
                            track(pending.shortUuid, 'pay_back')
                            // back to the choice; the invoice is still watched (it may be paid)
                            setShowPending(false)
                        }}
                        type="button"
                    >
                        <IconArrowLeft aria-hidden size={18} />
                        {t('coBack')}
                    </button>
                )}
            </div>
            {showQr && !paid && qrSrc && (
                <img alt={t('coOtherDevice')} className={classes.coQr} src={qrSrc} />
            )}
        </div>
    )
}
