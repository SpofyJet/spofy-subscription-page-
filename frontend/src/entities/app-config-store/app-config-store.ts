import {
    TSubscriptionPageLanguageCode,
    TSubscriptionPageRawConfig
} from '@remnawave/subscription-page-types'
import LanguageDetector from 'i18next-browser-languagedetector'
import { create } from 'zustand'

import { IActions, IState } from './interfaces'

const detector = new LanguageDetector()
detector.init({
    order: ['localStorage', 'navigator', 'htmlTag'],
    caches: ['localStorage']
})

function detectLanguage(
    supportedLocales: TSubscriptionPageLanguageCode[]
): TSubscriptionPageLanguageCode {
    const supported = (code: string | undefined) =>
        code && supportedLocales.includes(code as TSubscriptionPageLanguageCode)
            ? (code as TSubscriptionPageLanguageCode)
            : null

    // Spofy: a language picked on this page wins; otherwise walk the whole browser list
    // (uk-UA, ru-RU → ru), and anything we don't have falls back to Russian, not to the first
    // locale of the panel config.
    const stored = detector.detect(['localStorage'])
    const storedLang = supported((Array.isArray(stored) ? stored[0] : stored)?.split('-')[0])
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
            detector.cacheUserLanguage(lang)
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
