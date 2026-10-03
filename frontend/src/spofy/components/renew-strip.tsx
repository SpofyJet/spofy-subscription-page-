import { IconFlame } from '@tabler/icons-react'
import clsx from 'clsx'

import { useCheckoutStore } from '../checkout/checkout-store'
import { useMoney } from '../checkout/money'
import { maxDiscount, minPerMonth, payablePeriods } from '../checkout/offer-utils'
import { useSpofyT } from '../i18n'
import classes from '../spofy.module.css'
import { PeriodCard } from './period-card'

/**
 * Prices right on the page: «Продлить от 166 ₽/мес», «−46% за долгий срок» and a card per
 * period. A tap opens the sheet with that period already chosen.
 */
export function RenewStrip() {
    const { t } = useSpofyT()
    const money = useMoney()
    const { offer, offerError, open } = useCheckoutStore()

    if (offerError) return null
    if (!offer) {
        // Placeholder from the first frame, the same height as the loaded strip,
        // so nothing below jumps when prices arrive.
        return (
            <div aria-busy aria-hidden className={classes.strip}>
                <div className={classes.stripHead}>
                    <span className={clsx(classes.skel, classes.stripSkelHead)} />
                    <span className={clsx(classes.skel, classes.stripSkelChip)} />
                </div>
                <div className={classes.stripCards}>
                    {[0, 1, 2, 3].map((i) => (
                        <div className={clsx(classes.skel, classes.stripSkelCard)} key={i} />
                    ))}
                </div>
            </div>
        )
    }

    const { options, tariffId } = payablePeriods(offer)
    if (!offer.checkout_enabled || options.length === 0) return null
    const from = minPerMonth(options)
    const sale = maxDiscount(options)
    const trial = tariffId !== null

    return (
        <div aria-labelledby="sp-strip" className={classes.strip} role="group">
            <div className={classes.stripHead}>
                <span className={classes.stripTitle} id="sp-strip">
                    {from !== null
                        ? t(trial ? 'stripFromTrial' : 'stripFrom', { price: money(from) })
                        : t('renew')}
                </span>
                {sale > 0 && (
                    <span className={classes.stripSale}>
                        <IconFlame aria-hidden size={14} stroke={2.25} />
                        {t('stripSale', { p: sale })}
                    </span>
                )}
            </div>
            <div className={classes.stripCards}>
                {options.map((option) => (
                    <PeriodCard
                        compact
                        key={option.period_days}
                        onClick={() => open('renew', { periodDays: option.period_days, tariffId })}
                        option={option}
                    />
                ))}
            </div>
        </div>
    )
}
