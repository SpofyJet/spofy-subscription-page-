import { IOffer, IPeriodOption } from './api'

/** Periods the person can pay for now: renewal, or the first tariff for trial / tariff-less users. */
export function payablePeriods(offer: IOffer): {
    options: IPeriodOption[]
    tariffId: null | number
} {
    if (!offer.subscription.is_trial && offer.renewal.length > 0) {
        return { options: offer.renewal, tariffId: null }
    }
    const tariff = offer.tariffs[0]
    return { options: tariff?.periods ?? [], tariffId: tariff?.id ?? null }
}

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

export function minPerMonth(options: IPeriodOption[]): null | number {
    const values = options.filter((o) => o.price_kopeks > 0).map(perMonthKopeks)
    return values.length ? Math.min(...values) : null
}

export function maxDiscount(options: IPeriodOption[]): number {
    return options.reduce((best, o) => Math.max(best, discountOf(o)), 0)
}

/** Cheapest paid traffic package (smallest price), for «Вернуть обходы — купить N ГБ». */
export function cheapestTraffic(offer: IOffer | null): IOffer['traffic'][number] | null {
    const packages = (offer?.traffic ?? []).filter((p) => p.gb > 0 && p.price_kopeks > 0)
    return packages.reduce<IOffer['traffic'][number] | null>(
        (best, p) => (!best || p.price_kopeks < best.price_kopeks ? p : best),
        null
    )
}
