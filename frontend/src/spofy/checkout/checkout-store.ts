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

function loadPending(): IPendingPayment | null {
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return null
        const pending = JSON.parse(raw) as IPendingPayment
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
    if (error.code === 'bot_unavailable' || error.code === 'network' || error.status >= 500)
        return 'coErrBot'
    const detail = (error.detail ?? '').toLowerCase()
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
    opened: boolean
    pending: IPendingPayment | null
    preset: ICheckoutPreset | null
    setLatest: (snapshot: ISnapshot | null) => void
    setPending: (pending: IPendingPayment | null) => void
    setTab: (tab: TCheckoutTab) => void
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
    open: (tab, preset) => set({ opened: true, tab, preset: preset ?? null }),
    close: () => set({ opened: false }),
    setTab: (tab) => set({ tab }),
    setLatest: (latest) => set({ latest }),
    setPending: (pending) => {
        savePending(pending)
        set({ pending, latest: null })
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
