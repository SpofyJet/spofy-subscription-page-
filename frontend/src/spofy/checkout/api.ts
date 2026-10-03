/** Same-origin calls to the subscription page's /spofy-api proxy (session cookie required). */

export type TCheckoutKind = 'devices' | 'renew' | 'tariff' | 'traffic'

export interface ISnapshot {
    device_limit: number
    end_date: null | string
    is_trial: boolean
    status: string
    tariff_id: null | number
    tariff_name: null | string
    traffic_limit_gb: number
}

export interface IPeriodOption {
    discount_percent?: number
    is_highlighted?: boolean
    original_price_kopeks?: null | number
    period_days: number
    price_kopeks: number
}

export interface IOffer {
    checkout_enabled: boolean
    devices: {
        available: boolean
        can_add?: null | number
        current_device_limit?: number
        max_device_limit?: null | number
        /** monthly price of one device, before proration and discounts */
        base_device_price_kopeks?: number
        days_left?: number
        price_per_device_kopeks?: number
        /** bot's exact total for adding 1..N devices (bridge ≥ v2) */
        quotes?: { devices: number; discount_percent?: number; total_price_kopeks: number }[]
        reason?: string
        /** total for one device */
        total_price_kopeks?: number
    }
    disabled_reason: null | string
    payment_methods: {
        description: null | string
        id: string
        max_amount_kopeks: number
        min_amount_kopeks: number
        name: string
        options: { description?: string; id: string; name: string }[] | null
    }[]
    renewal: IPeriodOption[]
    restriction: null | string
    subscription: ISnapshot
    tariffs: {
        description: null | string
        device_limit: number
        id: number
        name: string
        periods: IPeriodOption[]
        traffic_limit_gb: number
    }[]
    traffic: {
        base_price_kopeks?: number
        discount_percent?: number
        gb: number
        price_kopeks: number
    }[]
}

export interface ICheckoutResult {
    amount_kopeks: number
    before: ISnapshot
    method: string
    payment_id: string
    payment_url: string
    price_kopeks: number
    qr_payload: null | string
}

export interface IPaymentStatus {
    is_paid: boolean | null
    status_text: null | string
    subscription: ISnapshot
}

export class CheckoutError extends Error {
    constructor(
        public readonly code: string,
        public readonly status: number,
        public readonly detail: null | string = null
    ) {
        super(code)
    }
}

/** /<prefix>/<shortUuid> → /<prefix>/spofy-api/<shortUuid> */
function base(shortUuid: string): string {
    const segments = window.location.pathname.split('/').filter(Boolean)
    if (segments.at(-1) === shortUuid) segments.pop()
    return `/${[...segments, 'spofy-api', encodeURIComponent(shortUuid)].join('/')}`
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    let response: Response
    try {
        response = await fetch(url, {
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            ...init
        })
    } catch {
        throw new CheckoutError('network', 0)
    }
    if (!response.ok) {
        let payload: { code?: string; detail?: null | string; status?: number } = {}
        try {
            payload = await response.json()
        } catch {
            // empty body
        }
        throw new CheckoutError(
            payload.code ?? 'error',
            payload.status ?? response.status,
            payload.detail ?? null
        )
    }
    return (await response.json()) as T
}

export const checkoutApi = {
    offer: (shortUuid: string) => request<IOffer>(`${base(shortUuid)}/offer`),
    checkout: (
        shortUuid: string,
        body: {
            devices?: number
            kind: TCheckoutKind
            payment_method: string
            payment_option?: null | string
            period_days?: number
            tariff_id?: number
            traffic_gb?: number
        }
    ) =>
        request<ICheckoutResult>(`${base(shortUuid)}/checkout`, {
            method: 'POST',
            body: JSON.stringify(body)
        }),
    status: (shortUuid: string, method: string, paymentId: string) =>
        request<IPaymentStatus>(
            `${base(shortUuid)}/payments/${encodeURIComponent(method)}/${encodeURIComponent(paymentId)}`
        )
}

/** Did the subscription change in the direction the purchase promises? */
export function isApplied(kind: TCheckoutKind, before: ISnapshot, now: ISnapshot): boolean {
    const end = (s: ISnapshot) => (s.end_date ? Date.parse(s.end_date) : 0)
    switch (kind) {
        case 'renew':
            return end(now) > end(before) + 60_000
        case 'tariff':
            return (
                (before.is_trial && !now.is_trial) ||
                now.tariff_id !== before.tariff_id ||
                end(now) > end(before) + 60_000
            )
        case 'devices':
            return now.device_limit > before.device_limit
        case 'traffic':
            return now.traffic_limit_gb !== before.traffic_limit_gb
    }
}
