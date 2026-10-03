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
    const packages = (offer?.traffic ?? []).filter((p) => p.gb > 0 && p.price_kopeks > 0)
    return packages.reduce<IOffer['traffic'][number] | null>(
        (best, p) => (!best || p.price_kopeks < best.price_kopeks ? p : best),
        null
    )
}
