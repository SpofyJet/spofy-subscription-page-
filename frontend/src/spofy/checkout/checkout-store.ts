import { create } from 'zustand'

import { ICheckoutResult, TCheckoutKind } from './api'

export type TCheckoutTab = 'devices' | 'renew' | 'traffic'

export interface IPendingPayment {
    createdAt: number
    kind: TCheckoutKind
    result: ICheckoutResult
    shortUuid: string
}

const KEY = 'spofy.subpage.pending'
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

interface IStore {
    close: () => void
    open: (tab: TCheckoutTab) => void
    opened: boolean
    pending: IPendingPayment | null
    setPending: (pending: IPendingPayment | null) => void
    tab: TCheckoutTab
}

export const useCheckoutStore = create<IStore>()((set) => ({
    opened: false,
    tab: 'renew',
    pending: loadPending(),
    open: (tab) => set({ opened: true, tab }),
    close: () => set({ opened: false }),
    setPending: (pending) => {
        savePending(pending)
        set({ pending })
    }
}))
