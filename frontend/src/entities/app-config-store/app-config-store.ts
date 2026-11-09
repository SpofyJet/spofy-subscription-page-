import {
    TSubscriptionPageLanguageCode,
    TSubscriptionPageRawConfig
} from '@remnawave/subscription-page-types'
import { create } from 'zustand'

import { IActions, IState } from './interfaces'

/** Same key as before, so a language people already picked stays picked. */
const LANGUAGE_KEY = 'i18nextLng'

function readStoredLanguage(): null | string {
    try {
        return window.localStorage.getItem(LANGUAGE_KEY)
    } catch {
        return null
    }
}

function storeLanguage(lang: string): void {
    try {
        window.localStorage.setItem(LANGUAGE_KEY, lang)
    } catch {
        // private mode: the choice just lasts until the page is closed
    }
}

export function detectLanguage(
    supportedLocales: TSubscriptionPageLanguageCode[]
): TSubscriptionPageLanguageCode {
    const supported = (code: string | undefined) =>
        code && supportedLocales.includes(code as TSubscriptionPageLanguageCode)
            ? (code as TSubscriptionPageLanguageCode)
            : null

    // Spofy: a language picked on this page wins; otherwise walk the whole browser list
    // (uk-UA, ru-RU → ru), and anything we don't have falls back to Russian, not to the first
    // locale of the panel config.
    const storedLang = supported(readStoredLanguage()?.split('-')[0])
    if (storedLang) return storedLang

    const browserLangs =
        typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
    for (const lang of browserLangs) {
        const match = supported(lang?.toLowerCase().split('-')[0])
        if (match) return match
    }

    return supported('ru') ?? supportedLocales[0]!
}

const initialState: IState = {
    config: null,
    currentLang: 'en',
    isConfigLoaded: false
}

export const useAppConfigStore = create<IActions & IState>()((set) => ({
    ...initialState,
    actions: {
        setConfig: (config: TSubscriptionPageRawConfig) => {
            const detectedLang = detectLanguage(config.locales)

            set({
                config,
                currentLang: detectedLang,
                isConfigLoaded: true
            })
        },

        setLanguage: (lang: TSubscriptionPageLanguageCode) => {
            storeLanguage(lang)
            set({ currentLang: lang })
        },

        getInitialState: () => {
            return initialState
        },

        resetState: async () => {
            set({ ...initialState })
        }
    }
}))

export const useAppConfigStoreActions = () => useAppConfigStore((store) => store.actions)

export const useAppConfigNullable = () => useAppConfigStore((state) => state.config)

export const useAppConfig = (): TSubscriptionPageRawConfig => {
    const config = useAppConfigStore((state) => state.config)
    if (!config) {
        throw new Error('useAppConfig must be used after config is loaded (after RootLayout gate)')
    }
    return config
}

export const useLocales = () => useAppConfigStore((state) => state.config!.locales)

export const useCurrentLang = () => useAppConfigStore((state) => state.currentLang)

export const useIsConfigLoaded = () => useAppConfigStore((state) => state.isConfigLoaded)
