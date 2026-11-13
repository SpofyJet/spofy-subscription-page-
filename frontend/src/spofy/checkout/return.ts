/**
 * Coming back from the payment provider.
 *
 * The provider is never given the subscription link (it is a credential): it returns the
 * person to a neutral address on this site — /spofy-api/payment/return, served by the backend
 * (backend/src/modules/spofy/return.page.ts, the same two keys). That screen reads the address
 * remembered here and sends the browser back to this page, where the invoice's status is shown.
 */

const RETURN_KEY = 'spofy.subpage.return'
const RETURNED_KEY = 'spofy.subpage.returned'
/** The mark is for the load that follows the return, not for a tab reopened later. */
const RETURNED_FRESH_MS = 60_000

/** Remember this page's address — when an invoice is created and when its payment is opened. */
export function rememberReturnAddress(): void {
    try {
        localStorage.setItem(
            RETURN_KEY,
            JSON.stringify({ t: Date.now(), u: window.location.pathname + window.location.search })
        )
    } catch {
        // storage unavailable: the return screen shows «payment received, open the bot»
    }
}

/** True once: the return screen has just sent this tab back to the page. */
export function cameBackFromPayment(): boolean {
    try {
        const at = Number(sessionStorage.getItem(RETURNED_KEY) ?? 0)
        if (!at) return false
        sessionStorage.removeItem(RETURNED_KEY)
        return Date.now() - at < RETURNED_FRESH_MS
    } catch {
        return false
    }
}
