import { create } from 'zustand'

/** Mirrors backend `ISpofyPageData` (backend/src/modules/spofy/spofy.service.ts). */
export interface ISpofyPageData {
    bypassDisabled: boolean
    cabinetUrl: null | string
    displayName: null | string
    renewUrl: null | string
    supportUrl: null | string
    trafficUrl: null | string
}

const EMPTY: ISpofyPageData = {
    bypassDisabled: false,
    cabinetUrl: null,
    displayName: null,
    renewUrl: null,
    supportUrl: null,
    trafficUrl: null
}

interface IStore {
    data: ISpofyPageData
    setFromPanelPayload: (payload: unknown) => void
}

const str = (value: unknown): null | string =>
    typeof value === 'string' && value.trim() !== '' ? value : null

export const useSpofyStore = create<IStore>()((set) => ({
    data: EMPTY,
    setFromPanelPayload: (payload) => {
        const raw = (payload as { spofy?: Record<string, unknown> } | null)?.spofy
        if (!raw || typeof raw !== 'object') {
            set({ data: EMPTY })
            return
        }
        set({
            data: {
                bypassDisabled: raw.bypassDisabled === true,
                cabinetUrl: str(raw.cabinetUrl),
                displayName: str(raw.displayName),
                renewUrl: str(raw.renewUrl),
                supportUrl: str(raw.supportUrl),
                trafficUrl: str(raw.trafficUrl)
            }
        })
    }
}))

export const useSpofyData = () => useSpofyStore((state) => state.data)
