import { GetSubscriptionInfoByShortUuidCommand } from '@remnawave/backend-contract'
import {
    TSubscriptionPageLanguageCode,
    TSubscriptionPagePlatformKey
} from '@remnawave/subscription-page-types'

import { translate } from './i18n'

export type TSpofyUser = GetSubscriptionInfoByShortUuidCommand.Response['response']['user']
export type TSpofyState = 'active' | 'disabled' | 'expired' | 'expiring' | 'limited'

export const EXPIRING_DAYS = 3
export const COUNTER_DAYS = 7

const intlLocale = (lang: TSubscriptionPageLanguageCode) => (lang === 'en' ? 'en-GB' : lang)

export function isIndefinite(expiresAt: Date | string): boolean {
    return new Date(expiresAt).getFullYear() >= 2099
}

export function getSubscriptionState(user: TSpofyUser, now = Date.now()): TSpofyState {
    switch (user.userStatus) {
        case 'EXPIRED':
            return 'expired'
        case 'DISABLED':
            return 'disabled'
        case 'LIMITED':
            return 'limited'
        default:
            break
    }
    if (!isIndefinite(user.expiresAt) && new Date(user.expiresAt).getTime() <= now) {
        return 'expired'
    }
    if (!isIndefinite(user.expiresAt) && user.daysLeft <= EXPIRING_DAYS) {
        return 'expiring'
    }
    return 'active'
}

export const isInactiveState = (state: TSpofyState) =>
    state === 'expired' || state === 'disabled' || state === 'limited'

export function formatDate(date: Date | string, lang: TSubscriptionPageLanguageCode): string {
    try {
        return new Intl.DateTimeFormat(intlLocale(lang), {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(new Date(date))
    } catch {
        return new Date(date).toLocaleDateString()
    }
}

export function formatDays(n: number, lang: TSubscriptionPageLanguageCode): string {
    let rule = 'other'
    try {
        rule = new Intl.PluralRules(intlLocale(lang)).select(n)
    } catch {
        // keep "other"
    }
    const key = `day_${rule}` as 'day_few' | 'day_many' | 'day_one' | 'day_other'
    return translate(lang, key)
}

function plural(n: number, lang: TSubscriptionPageLanguageCode, unit: 'day' | 'month' | 'year') {
    let rule = 'other'
    try {
        rule = new Intl.PluralRules(intlLocale(lang)).select(n)
    } catch {
        // keep "other"
    }
    return translate(lang, `${unit}_${rule}` as `${typeof unit}_few`)
}

/** 30 → «1 месяц», 90 → «3 месяца», 365 → «1 год», 14 → «14 дней» */
export function formatPeriod(days: number, lang: TSubscriptionPageLanguageCode): string {
    const years = Math.round(days / 365)
    if (years >= 1 && (days === years * 360 || Math.abs(days - years * 365) <= years)) {
        return `${years} ${plural(years, lang, 'year')}`
    }
    if (days >= 28 && days % 30 === 0) {
        const months = days / 30
        return `${months} ${plural(months, lang, 'month')}`
    }
    return `${days} ${plural(days, lang, 'day')}`
}

const BYTE_UNITS: Partial<Record<TSubscriptionPageLanguageCode, string[]>> = {
    ru: ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'],
    fr: ['o', 'Ko', 'Mo', 'Go', 'To']
}
const BYTE_UNITS_DEFAULT = ['B', 'KB', 'MB', 'GB', 'TB']

export function formatBytes(bytes: number, lang: TSubscriptionPageLanguageCode): string {
    const units = BYTE_UNITS[lang] ?? BYTE_UNITS_DEFAULT
    let value = Math.max(0, bytes)
    let unit = 0
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024
        unit++
    }
    const digits = unit === 0 || value >= 10 ? 0 : 1
    const number = new Intl.NumberFormat(intlLocale(lang), {
        maximumFractionDigits: digits
    }).format(value)
    return `${number} ${units[unit]}`
}

export function toNumber(value: string | number | undefined | null): number {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
}

/** Best guess of the visitor's platform from the user agent. */
export function detectPlatform(
    ua: string,
    maxTouchPoints: number
): TSubscriptionPagePlatformKey | undefined {
    if (/AppleTV|tvOS/i.test(ua)) return 'appleTV'
    if (/Android.*\b(TV|AFT\w*)\b|GoogleTV|BRAVIA|\bAFT[A-Z]/i.test(ua)) return 'androidTV'
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
    if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios' // iPadOS desktop UA
    if (/Android/i.test(ua)) return 'android'
    if (/Windows/i.test(ua)) return 'windows'
    if (/Mac OS X|Macintosh/i.test(ua)) return 'macos'
    if (/Linux|X11|CrOS/i.test(ua)) return 'linux'
    return undefined
}

export const PLATFORM_ORDER: TSubscriptionPagePlatformKey[] = [
    'ios',
    'android',
    'windows',
    'macos',
    'linux',
    'androidTV',
    'appleTV'
]

/** "2 окт. 2026 г." — for compact tiles */
export function formatDateShort(date: Date | string, lang: TSubscriptionPageLanguageCode): string {
    try {
        return new Intl.DateTimeFormat(intlLocale(lang), {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(new Date(date))
    } catch {
        return new Date(date).toLocaleDateString()
    }
}

/** "01.11.2026" — numeric date for the compact hero tiles */
export function formatDateNumeric(
    date: Date | string,
    lang: TSubscriptionPageLanguageCode
): string {
    try {
        return new Intl.DateTimeFormat(intlLocale(lang), {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date(date))
    } catch {
        return new Date(date).toLocaleDateString()
    }
}
