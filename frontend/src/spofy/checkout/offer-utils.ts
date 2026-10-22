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

/** Price for 30 days, rounded to whole rubles (in kopeks). */
export function perMonthKopeks(option: IPeriodOption): number {
    const months = option.period_days / 30
    return Math.round(option.price_kopeks / months / 100) * 100
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
    const paid = options.filter((o) => o.price_kopeks > 0)
    const upToYear = paid.filter((o) => o.period_days <= 366)
    const values = (upToYear.length ? upToYear : paid).map(perMonthKopeks)
    return values.length ? Math.min(...values) : null
}

/**
 * The period to preselect: the one the bot marks with a star, else 3 months, else 1 month,
 * else the first. Never the shortest by accident — 14 days is the dearest per month.
 */
export function defaultPeriod(options: IPeriodOption[]): IPeriodOption | undefined {
    return (
        options.find((o) => o.is_highlighted) ??
        options.find((o) => o.period_days === 90) ??
        options.find((o) => o.period_days === 30) ??
        options[0]
    )
}
