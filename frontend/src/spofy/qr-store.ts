import { create } from 'zustand'

/** Lets any part of the page open the QR modal rendered by the link card. */
export const useQrStore = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
    open: false,
    setOpen: (open) => set({ open })
}))
