import { create } from 'zustand'

import { TSpofyKey } from '../i18n'
import {
    CheckoutError,
    checkoutApi,
    ICheckoutResult,
    IOffer,
    ISnapshot,
    TCheckoutKind
} from './api'

export type TCheckoutTab = 'devices' | 'renew' | 'traffic'

/** What to preselect when the sheet opens from a card or a CTA on the page. */
export interface ICheckoutPreset {
    periodDays?: number
    tariffId?: null | number
    trafficGb?: number
}

export interface IPendingPayment {
    createdAt: number
    kind: TCheckoutKind
    result: ICheckoutResult
    shortUuid: string
    /** what was bought, already translated ("Продление на 1 месяц") */
    summary?: string
}

const KEY = 'spofy.subpage.pending'
const METHOD_KEY = 'spofy.subpage.method'
const TTL_MS = 30 * 60_000

/** A stored entry must look like a payment we created — a corrupt one is dropped, not polled. */
function isPendingPayment(pending: unknown): pending is IPendingPayment {
    if (!pending || typeof pending !== 'object') return false
    const p = pending as IPendingPayment
    return (
        typeof p.createdAt === 'number' &&
        typeof p.shortUuid === 'string' &&
        (p.kind === 'devices' || p.kind === 'renew' || p.kind === 'tariff' || p.kind === 'traffic') &&
        !!p.result &&
        typeof p.result === 'object' &&
        typeof p.result.payment_id === 'string' &&
        typeof p.result.method === 'string'
    )
}

function loadPending(): IPendingPayment | null {
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return null
        const pending = JSON.parse(raw) as unknown
        if (!isPendingPayment(pending)) {
            localStorage.removeItem(KEY)
            return null
        }
        return Date.now() - pending.createdAt < TTL_MS ? pending : null
    } catch {
        return null
    }
}

function savePending(pending: IPendingPayment | null) {
    try {
        if (pending) localStorage.setItem(KEY, JSON.stringify(pending))
        else localStorage.removeItem(KEY)
    } catch {
        // storage unavailable — the sheet still works while open
    }
}

export function loadMethod(): null | string {
    try {
        return localStorage.getItem(METHOD_KEY)
    } catch {
        return null
    }
}

export function saveMethod(id: string) {
    try {
        localStorage.setItem(METHOD_KEY, id)
    } catch {
        // per-viewer convenience only
    }
}

/** What to tell the person. `phase` = loading the options or creating the payment. */
export const errorKey = (error: unknown, phase: 'checkout' | 'offer' = 'checkout'): TSpofyKey => {
    if (!(error instanceof CheckoutError)) return phase === 'offer' ? 'coErrLoad' : 'coErrGeneric'
    if (error.code === 'rate_limited') return 'coErrRate'
    if (error.code === 'no_session') return 'coErrSession'
    if (error.code === 'bridge_error' && error.status === 404) return 'coErrNotInBot'
    if (error.status === 409 || error.code === 'checkout_disabled') return 'coErrDisabled'
    if (phase === 'offer') return 'coErrLoad'
    const detail = (error.detail ?? '').toLowerCase()
    // «Failed to create Platega payment» / «temporarily unavailable»: one provider is down, the bot works.
    if (/failed to create .*payment|temporarily unavailable/.test(detail)) return 'coErrMethodDown'
    if (error.code === 'bot_unavailable' || error.code === 'network' || error.status >= 500)
        return 'coErrBot'
    if (detail.includes('payment method')) return 'coErrMethod'
    if (detail.includes('exceeds')) return 'coErrLimit'
    if (detail.includes('restricted')) return 'coErrRestricted'
    return 'coErrGeneric'
}

/** Bot details that already have a translated message are not repeated in brackets. */
export const KNOWN_ERROR_KEYS: TSpofyKey[] = [
    'coErrMethod',
    'coErrLimit',
    'coErrRestricted',
    'coErrBot'
]

interface IStore {
    close: () => void
    /** latest subscription snapshot seen while polling a payment */
    latest: ISnapshot | null
    /** fetch the offer once per page (or again after an error when `force`) */
    loadOffer: (shortUuid: string, force?: boolean) => void
    offer: IOffer | null
    offerError: null | TSpofyKey
    offerLoading: boolean
    open: (tab: TCheckoutTab, preset?: ICheckoutPreset) => void
    /** open the window on the unpaid invoice itself (the banner, «Открыть счёт») */
    openPayment: () => void
    opened: boolean
    pending: IPendingPayment | null
    preset: ICheckoutPreset | null
    setLatest: (snapshot: ISnapshot | null) => void
    setPending: (pending: IPendingPayment | null) => void
    setShowPending: (show: boolean) => void
    setTab: (tab: TCheckoutTab) => void
    /** The window shows the unpaid invoice rather than the choice. An unpaid invoice must never
     *  swallow the page's buttons: «Добавить устройство» opens the devices choice, with a note
     *  about the invoice on top. */
    showPending: boolean
    tab: TCheckoutTab
}

export const useCheckoutStore = create<IStore>()((set, get) => ({
    opened: false,
    tab: 'renew',
    pending: loadPending(),
    latest: null,
    offer: null,
    offerError: null,
    offerLoading: false,
    preset: null,
    showPending: false,
    open: (tab, preset) => set({ opened: true, tab, preset: preset ?? null, showPending: false }),
    openPayment: () => set({ opened: true, showPending: true }),
    close: () => set({ opened: false }),
    setShowPending: (showPending) => set({ showPending }),
    setTab: (tab) => set({ tab }),
    setLatest: (latest) => set({ latest }),
    setPending: (pending) => {
        savePending(pending)
        // a payment just created is shown at once; clearing one goes back to the choice
        set({ pending, latest: null, showPending: !!pending })
    },
    loadOffer: (shortUuid, force = false) => {
        const { offer, offerError, offerLoading } = get()
        if (offerLoading || offer || (offerError && !force)) return
        set({ offerLoading: true, offerError: null })
        checkoutApi
            .offer(shortUuid)
            .then((next) => set({ offer: next, offerLoading: false }))
            .catch((error) => set({ offerError: errorKey(error, 'offer'), offerLoading: false }))
    }
}))
