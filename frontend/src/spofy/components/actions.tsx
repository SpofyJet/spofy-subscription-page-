import { IconAlertTriangle, IconPlus } from '@tabler/icons-react'

import { useCheckoutStore } from '../checkout/checkout-store'
import { useMoney } from '../checkout/money'
import { cheapestTraffic } from '../checkout/offer-utils'
import { useSpofyT } from '../i18n'
import classes from '../spofy.module.css'
import { ActionLink } from './banner'

/** Bypass servers are off (traffic used up): one tap to buy the cheapest package on the page. */
export function BypassNotice({
    checkout,
    trafficUrl
}: {
    checkout: boolean
    trafficUrl: null | string
}) {
    const { t } = useSpofyT()
    const money = useMoney()
    const { offer, offerError, open } = useCheckoutStore()
    const pack = checkout && offerError !== 'coErrNotInBot' ? cheapestTraffic(offer) : null

    return (
        <section className={classes.notice} role="status">
            <span aria-hidden className={classes.noticeIcon}>
                <IconAlertTriangle size={22} stroke={1.9} />
            </span>
            <div className={classes.noticeBody}>
                <p className={classes.noticeText}>{t('bypassText')}</p>
                {pack ? (
                    <ActionLink
                        glow
                        href="#"
                        icon={<IconPlus aria-hidden size={18} stroke={2.25} />}
                        label={t('bypassBuy', {
                            gb: t('coGb', { n: pack.gb }),
                            price: money(pack.price_kopeks)
                        })}
                        onClick={() => open('traffic', { trafficGb: pack.gb })}
                        primary
                    />
                ) : (
                    trafficUrl && (
                        <ActionLink
                            href={trafficUrl}
                            icon={<IconPlus aria-hidden size={18} stroke={2} />}
                            label={t('buyTraffic')}
                            small
                        />
                    )
                )}
            </div>
        </section>
    )
}
