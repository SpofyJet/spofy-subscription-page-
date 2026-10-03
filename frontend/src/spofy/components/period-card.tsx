import { IconCheck } from '@tabler/icons-react'
import clsx from 'clsx'

import { IPeriodOption } from '../checkout/api'
import { useMoney } from '../checkout/money'
import { discountOf, perMonthKopeks } from '../checkout/offer-utils'
import { formatPeriod } from '../format'
import { useSpofyT } from '../i18n'
import classes from '../spofy.module.css'

/**
 * One renewal period in the purchase sheet: title, price, price per month and a glowing
 * green discount.
 */
export function PeriodCard({
    checked,
    onClick,
    option
}: {
    checked: boolean
    onClick: () => void
    option: IPeriodOption
}) {
    const { t, lang } = useSpofyT()
    const money = useMoney()
    const discount = discountOf(option)
    const months = option.period_days / 30
    const strike =
        option.original_price_kopeks && option.original_price_kopeks > option.price_kopeks
            ? option.original_price_kopeks
            : null

    return (
        <button
            aria-checked={checked}
            className={clsx(
                classes.pcard,
                option.is_highlighted && classes.pcardHit,
                discount > 0 && classes.pcardSale
            )}
            onClick={onClick}
            role="radio"
            type="button"
        >
            {option.is_highlighted && <span className={classes.pcardRibbon}>{t('stripHit')}</span>}
            <span className={classes.pcardTop}>
                <span className={classes.pcardTitle}>{formatPeriod(option.period_days, lang)}</span>
                {discount > 0 ? (
                    <span className={clsx(classes.pcardDiscount, classes.num)}>−{discount}%</span>
                ) : (
                    <span aria-hidden className={classes.pcardCheck}>
                        <IconCheck size={12} stroke={3} />
                    </span>
                )}
            </span>
            <span className={clsx(classes.pcardPrice, classes.num)}>
                {money(option.price_kopeks)}
                {strike ? <s className={classes.coStrike}>{money(strike)}</s> : null}
            </span>
            <span className={clsx(classes.pcardMeta, classes.num)}>
                {months >= 2
                    ? t('perMonthShort', { price: money(perMonthKopeks(option)) })
                    : '\u00A0'}
            </span>
            {discount > 0 && (
                <span aria-hidden className={clsx(classes.pcardCheck, classes.pcardCheckBottom)}>
                    <IconCheck size={12} stroke={3} />
                </span>
            )}
        </button>
    )
}
