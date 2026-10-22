import { isForeverDays } from '../format'
import { IOffer, IPeriodOption } from './api'

/** Discount in percent from the bot's numbers (explicit percent, else original vs final price). */
export function discountOf(option: IPeriodOption): number {
    if (option.discount_percent && option.discount_percent > 0)
        return Math.round(option.discount_percent)
    if (option.original_price_kopeks && option.original_price_kopeks > option.price_kopeks) {
        return Math.round((1 - option.price_kopeks / option.original_price_kopeks) * 100)
    }
    return 0
}

/**
 * How many calendar months a period is, the way people count: 365 days = 12, 180 = 6, 90 = 3.
 * Shorter than four weeks stays a fraction of a 30-day month (14 days = 0.47).
 */
export function monthsOf(periodDays: number): number {
    return periodDays >= 28 ? Math.max(1, Math.round(periodDays / 30.4375)) : periodDays / 30
}

/** Price per month, rounded to whole rubles (in kopeks): 1 800 ₽ for a year → 150 ₽. */
export function perMonthKopeks(option: IPeriodOption): number {
    return Math.round(option.price_kopeks / monthsOf(option.period_days) / 100) * 100
}

/** Cheapest paid traffic package (smallest price), for «Вернуть обходы — купить N ГБ». */
export function cheapestTraffic(offer: IOffer | null): IOffer['traffic'][number] | null {
    // A trial subscription cannot buy traffic (the bot refuses): never offer it.
    if (offer?.subscription.is_trial) return null
    const packages = (offer?.traffic ?? []).filter((p) => p.gb > 0 && p.price_kopeks > 0)
    return packages.reduce<IOffer['traffic'][number] | null>(
        (best, p) => (!best || p.price_kopeks < best.price_kopeks ? p : best),
        null
    )
}

/**
 * Cheapest price per month for «от N ₽/мес». Periods longer than a year are left out when shorter
 * ones exist: a multi-year plan would advertise a monthly price almost nobody pays.
 */
export function minPerMonth(options: IPeriodOption[]): null | number {
    return cheapestPerMonth(options)?.perMonth ?? null
}

/** The same, with the period that gives it — for «от 150 ₽/мес при оплате за 1 год». */
export function cheapestPerMonth(
    options: IPeriodOption[]
): null | { periodDays: number; perMonth: number } {
    // «навсегда» (ULTIMA) has no price per month at all
    const paid = options.filter((o) => o.price_kopeks > 0 && !isForeverDays(o.period_days))
    const upToYear = paid.filter((o) => o.period_days <= 366)
    let best: null | { periodDays: number; perMonth: number } = null
    for (const o of upToYear.length ? upToYear : paid) {
        const perMonth = perMonthKopeks(o)
        if (!best || perMonth < best.perMonth) best = { periodDays: o.period_days, perMonth }
    }
    return best
}

/**
 * The period to preselect and mark «Рекомендуем»: the one the bot marks with a star, else 3 months
 * (owner's decision 23.10.2026), else 1 month, else the first. Never the shortest by accident —
 * 14 days is the dearest per month.
 */
export function defaultPeriod(options: IPeriodOption[]): IPeriodOption | undefined {
    return (
        options.find((o) => o.is_highlighted) ??
        options.find((o) => o.period_days === 90) ??
        options.find((o) => o.period_days === 30) ??
        options[0]
    )
}

/**
 * The plan offered to a trial user first: the one with «Обход» servers (owner's decision
 * 23.10.2026), else the bot's first plan.
 */
export function offeredTariff<T extends { name: string }>(tariffs: T[]): T | undefined {
    return tariffs.find((tariff) => /обход|bypass/i.test(tariff.name)) ?? tariffs[0]
}
