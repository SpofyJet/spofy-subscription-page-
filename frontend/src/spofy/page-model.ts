import { useEffect } from 'react'

import { useSubscription } from '@entities/subscription-info-store'

import { TCheckoutTab, ICheckoutPreset, useCheckoutStore } from './checkout/checkout-store'
import { cheapestPerMonth, cheapestTraffic, offeredTariff } from './checkout/offer-utils'
import { getSubscriptionState, isIndefinite, toNumber, TSpofyState } from './format'
import { useSpofyData } from './spofy-store'

/**
 * What the page shows, decided in one place.
 *
 * Each subscription gets one of six views with its own card, wording and a single main action:
 *  - active   — everything works: quiet status, the connection guide leads
 *  - expiring — ≤ 3 days left: the card asks to renew
 *  - trial    — free trial: its own card, «choose a plan», nothing to top up
 *  - expired / disabled — VPN is off: one action, «renew»
 *  - limited  — panel traffic limit reached: «buy traffic»
 */
/** id of the connection guide: «Подключить устройство» scrolls there */
export const CONNECT_ID = 'sp-connect'

export type TView = 'active' | 'disabled' | 'expired' | 'expiring' | 'limited' | 'trial'

/** A purchase entry point: opens the in-page sheet, or links to the bot when that is not available. */
export interface IAction {
    href?: string
    onClick?: () => void
}

export interface IPageModel {
    view: TView
    state: TSpofyState
    /** the bot says this is a free trial (cached per link, so repeat visits render it at once) */
    trial: boolean
    indefinite: boolean
    hasTrafficLimit: boolean
    bypassOff: boolean
    renew: IAction | null
    devices: IAction | null
    traffic: IAction | null
    /** cheapest monthly price (kopeks) of a renewal or, for a trial, of the offered plan,
     *  and the period that gives it («при оплате за 1 год») */
    renewFrom: null | { periodDays: number; perMonth: number }
    /** purchases open the sheet on this page; false → they open the bot */
    inPage: boolean
    /** no device has ever been connected (panel's HWID count is 0) */
    noDevices: boolean
    /** cheapest traffic package, for «from 59 ₽» */
    trafficFrom: null | { gb: number; price_kopeks: number }
    /** the bot's price for one more device (kopeks) */
    deviceFrom: null | number
}

const TRIAL_KEY = 'spofy.subpage.trial'

function readTrialHint(shortUuid: string): boolean {
    try {
        return localStorage.getItem(TRIAL_KEY) === shortUuid
    } catch {
        return false
    }
}

function writeTrialHint(shortUuid: string, trial: boolean) {
    try {
        if (trial) localStorage.setItem(TRIAL_KEY, shortUuid)
        else if (localStorage.getItem(TRIAL_KEY) === shortUuid) localStorage.removeItem(TRIAL_KEY)
    } catch {
        // per-viewer convenience only
    }
}

export function usePageModel(): IPageModel {
    const { user } = useSubscription()
    const spofy = useSpofyData()
    const offer = useCheckoutStore((s) => s.offer)
    const offerError = useCheckoutStore((s) => s.offerError)
    const loadOffer = useCheckoutStore((s) => s.loadOffer)
    const open = useCheckoutStore((s) => s.open)

    const checkout = spofy.checkoutEnabled
    // Prices, the trial flag and what is for sale come from the bot: ask right away.
    useEffect(() => {
        if (checkout) loadOffer(user.shortUuid)
    }, [checkout, loadOffer, user.shortUuid])

    const trial = offer ? offer.subscription.is_trial : readTrialHint(user.shortUuid)
    useEffect(() => {
        if (offer) writeTrialHint(user.shortUuid, offer.subscription.is_trial)
    }, [offer, user.shortUuid])

    const state = getSubscriptionState(user)
    const view: TView =
        state === 'disabled' || state === 'expired' || state === 'limited'
            ? state
            : trial
              ? 'trial'
              : state
    const dormant = state === 'expired' || state === 'disabled'
    const indefinite = isIndefinite(user.expiresAt)

    // Subscriptions the bot does not know keep the old behaviour: buttons link to the bot.
    const inPage = checkout && offerError !== 'coErrNotInBot'
    const sheet = (tab: TCheckoutTab, preset?: ICheckoutPreset): IAction => ({
        onClick: () => open(tab, preset)
    })
    const link = (url: null | string): IAction | null => (url ? { href: url } : null)

    // The panel's limit is what the person sees counted on this page — the only source used here.
    const hasTrafficLimit = toNumber(user.trafficLimitBytes) > 0

    const renew: IAction | null = inPage ? sheet('renew') : link(spofy.renewUrl)

    const devicesForSale =
        !dormant &&
        !trial &&
        (inPage
            ? !offer || (!!offer.devices.available && (offer.devices.can_add ?? 1) > 0)
            : !!spofy.renewUrl)
    const devices = devicesForSale ? (inPage ? sheet('devices') : link(spofy.renewUrl)) : null

    const trafficForSale =
        hasTrafficLimit &&
        !dormant &&
        !trial &&
        (inPage ? (offer ? offer.traffic.length > 0 : true) : !!spofy.trafficUrl)
    const pack = inPage ? cheapestTraffic(offer) : null
    const traffic = trafficForSale
        ? inPage
            ? sheet('traffic', pack ? { trafficGb: pack.gb } : undefined)
            : link(spofy.trafficUrl)
        : null

    let renewFrom: IPageModel['renewFrom'] = null
    if (inPage && offer) {
        renewFrom = trial
            ? cheapestPerMonth(offeredTariff(offer.tariffs)?.periods ?? [])
            : cheapestPerMonth(offer.renewal)
    }

    return {
        view,
        state,
        trial,
        indefinite,
        hasTrafficLimit,
        bypassOff: spofy.bypassDisabled,
        renew,
        devices,
        traffic,
        renewFrom,
        inPage,
        noDevices: spofy.devicesUsed === 0,
        trafficFrom: pack,
        deviceFrom:
            inPage && offer
                ? (offer.devices.quotes?.[0]?.total_price_kopeks ??
                  offer.devices.total_price_kopeks ??
                  null)
                : null
    }
}
