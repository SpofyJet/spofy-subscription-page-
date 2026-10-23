import { IconCheck, IconLoader2, IconX } from '@tabler/icons-react'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

import { vibrate } from '@shared/utils/vibrate'

import { useSubscription } from '@entities/subscription-info-store'

import { useSpofyT } from '../i18n'
import classes from '../spofy.module.css'
import { CheckoutError, checkoutApi, isApplied, trackOnce } from './api'
import { useCheckoutStore } from './checkout-store'
import { useMoney } from './money'

/* Kept out of the lazily loaded sheet: a payment started earlier is watched from page load. */

const POLL_MS = 4_000
const GIVE_UP_MS = 15 * 60_000

/** Remember (per payment) that the payment page was opened, to count a «return». */
const OPENED_KEY = 'spofy.subpage.payopened'
export function markPayOpened(paymentId: string): void {
    try {
        sessionStorage.setItem(OPENED_KEY, paymentId)
    } catch {
        // storage unavailable: the return just is not counted
    }
}
function wasPayOpened(paymentId: string): boolean {
    try {
        return sessionStorage.getItem(OPENED_KEY) === paymentId
    } catch {
        return false
    }
}

/* ───────────── payment status watcher (runs while a payment is pending) ───────────── */

export type TPhase = 'done' | 'expired' | 'paid' | 'timeout' | 'waiting'

export function usePendingPhase(): TPhase | null {
    const pending = useCheckoutStore((s) => s.pending)
    const setLatest = useCheckoutStore((s) => s.setLatest)
    const subscription = useSubscription()
    const [phase, setPhase] = useState<TPhase | null>(null)

    useEffect(() => {
        if (!pending || pending.shortUuid !== subscription.user.shortUuid) {
            setPhase(null)
            return
        }
        let stopped = false
        let timer: number | undefined
        let running = false
        let announcedReturn = false
        setPhase('waiting')

        const tick = async () => {
            window.clearTimeout(timer)
            if (stopped || running) return
            if (Date.now() - pending.createdAt > GIVE_UP_MS) {
                trackOnce(pending.shortUuid, 'pay_timeout', pending.result.payment_id)
                setPhase('timeout')
                return
            }
            running = true
            try {
                const status = await checkoutApi.status(
                    pending.shortUuid,
                    pending.result.method,
                    pending.result.payment_id
                )
                if (isApplied(pending.kind, pending.result.before, status.subscription)) {
                    vibrate('success')
                    setLatest(status.subscription)
                    trackOnce(pending.shortUuid, 'pay_done', pending.result.payment_id)
                    setPhase('done')
                    return
                }
                if (status.is_paid) setPhase('paid')
            } catch (error) {
                // The page session is gone (cookie expired): polling cannot recover by itself —
                // stop and ask for a reload; a fresh session keeps watching the same payment.
                if (error instanceof CheckoutError && error.code === 'no_session') {
                    setPhase('expired')
                    return
                }
                // transient: keep polling
            } finally {
                running = false
            }
            if (!stopped) timer = window.setTimeout(tick, POLL_MS)
        }

        // iPhone freezes the page while the payment tab is in front: the moment the person comes
        // back, check at once instead of waiting for the next timer.
        const comeBack = () => {
            if (document.visibilityState !== 'visible') return
            if (!announcedReturn && wasPayOpened(pending.result.payment_id)) {
                announcedReturn = true
                trackOnce(pending.shortUuid, 'pay_return', pending.result.payment_id)
            }
            void tick()
        }
        document.addEventListener('visibilitychange', comeBack)
        window.addEventListener('pageshow', comeBack)
        window.addEventListener('focus', comeBack)

        timer = window.setTimeout(tick, 1_500)
        return () => {
            stopped = true
            window.clearTimeout(timer)
            document.removeEventListener('visibilitychange', comeBack)
            window.removeEventListener('pageshow', comeBack)
            window.removeEventListener('focus', comeBack)
        }
    }, [pending, subscription.user.shortUuid, setLatest])

    return phase
}

/* ───────────── small banner while a payment is pending and the sheet is closed ───────────── */

export function PendingBanner({ phase }: { phase: TPhase | null }) {
    const { opened, pending, openPayment, setPending } = useCheckoutStore()
    const subscription = useSubscription()
    const money = useMoney()
    const { t } = useSpofyT()
    if (opened || !pending || pending.shortUuid !== subscription.user.shortUuid || !phase)
        return null

    const done = phase === 'done'
    const expired = phase === 'expired'
    const paid = phase === 'paid'
    return (
        <div
            aria-live="polite"
            className={clsx(classes.pendingBanner, done && classes.coStatusDone)}
        >
            <button
                className={classes.pendingMain}
                disabled={done}
                onClick={() => openPayment()}
                type="button"
            >
                {done ? (
                    <IconCheck aria-hidden size={20} />
                ) : (
                    <IconLoader2 aria-hidden className={classes.spin} size={20} />
                )}
                <span className={classes.pendingText}>
                    {done
                        ? t('coPendingDone')
                        : expired
                          ? t('coSessionExpired')
                          : paid
                            ? t('coPaid')
                            : t('coPendingBanner', { price: money(pending.result.amount_kopeks) })}
                </span>
                {!done && <span className={classes.pendingOpen}>{t('coPendingOpen')}</span>}
            </button>
            {/* an invoice the person changed their mind about: forget it here (only while unpaid) */}
            {!done && !paid && (
                <button
                    aria-label={t('coPendingHide')}
                    className={classes.pendingHide}
                    onClick={() => setPending(null)}
                    type="button"
                >
                    <IconX aria-hidden size={18} stroke={2.2} />
                </button>
            )}
        </div>
    )
}
