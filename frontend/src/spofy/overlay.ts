import { RefObject, useEffect, useRef } from 'react'

/* ───────── «Назад» closes the window, not the page ───────── */

/** popstate events caused by our own `history.back()` (closing with ✕): not a «Назад» tap. */
const ownPops = new WeakSet<Event>()
let pendingOwnPops = 0
if (typeof window !== 'undefined') {
    // registered first, so it marks the event before any window's own listener sees it
    window.addEventListener('popstate', (event) => {
        if (pendingOwnPops > 0) {
            pendingOwnPops -= 1
            ownPops.add(event)
        }
    })
}

/**
 * While a window (purchase sheet, QR) is open it owns one step of the browser history, so the
 * Android «Назад» button / back swipe closes it instead of leaving the page. Closing it any
 * other way gives that step back.
 */
export function useBackToClose(opened: boolean, close: () => void): void {
    const closeRef = useRef(close)
    useEffect(() => {
        closeRef.current = close
    }, [close])

    useEffect(() => {
        if (!opened) return
        window.history.pushState({ ...window.history.state, spOverlay: true }, '')
        let poppedByBack = false
        const onPop = (event: PopStateEvent) => {
            if (ownPops.has(event)) return
            poppedByBack = true
            closeRef.current()
        }
        window.addEventListener('popstate', onPop)
        return () => {
            window.removeEventListener('popstate', onPop)
            if (!poppedByBack && window.history.state?.spOverlay) {
                pendingOwnPops += 1
                window.history.back()
            }
        }
    }, [opened])
}

/* ───────── swipe the sheet down by its top to close it ───────── */

const CLOSE_DISTANCE = 90
const CLOSE_SPEED = 0.6 // px per ms

/**
 * The grabber at the top of a bottom sheet promises «pull me down». Dragging starts only in the
 * top zone (grabber + title), so it never fights with scrolling the sheet's content.
 */
export function useSwipeToClose(
    anchor: RefObject<HTMLElement | null>,
    opened: boolean,
    close: () => void
): void {
    const closeRef = useRef(close)
    useEffect(() => {
        closeRef.current = close
    }, [close])

    useEffect(() => {
        if (!opened) return
        let sheet: HTMLElement | null = null
        let raf = 0
        // the sheet is mounted by the Drawer a frame later
        const attach = () => {
            sheet = anchor.current?.closest<HTMLElement>('.mantine-Drawer-content') ?? null
            if (!sheet) {
                raf = window.requestAnimationFrame(attach)
                return
            }
            sheet.addEventListener('touchstart', onStart, { passive: true })
        }
        let startY = 0
        let startTime = 0
        let dy = 0
        let dragging = false

        const onStart = (event: TouchEvent) => {
            if (!sheet || event.touches.length !== 1) return
            const touch = event.touches[0]!
            const top = sheet.getBoundingClientRect().top
            if (touch.clientY - top > 72) return // only the grabber and title zone
            dragging = true
            startY = touch.clientY
            startTime = performance.now()
            dy = 0
            sheet.style.transition = 'none'
            window.addEventListener('touchmove', onMove, { passive: false })
            window.addEventListener('touchend', onEnd)
            window.addEventListener('touchcancel', onEnd)
        }
        const onMove = (event: TouchEvent) => {
            if (!dragging || !sheet) return
            dy = Math.max(0, event.touches[0]!.clientY - startY)
            if (dy > 0) event.preventDefault()
            sheet.style.transform = `translateY(${dy}px)`
        }
        const onEnd = () => {
            window.removeEventListener('touchmove', onMove)
            window.removeEventListener('touchend', onEnd)
            window.removeEventListener('touchcancel', onEnd)
            if (!dragging || !sheet) return
            dragging = false
            const speed = dy / Math.max(1, performance.now() - startTime)
            const el = sheet
            if (dy > CLOSE_DISTANCE || (dy > 24 && speed > CLOSE_SPEED)) {
                el.style.transition = 'transform 0.18s ease-in'
                el.style.transform = 'translateY(100%)'
                window.setTimeout(() => {
                    closeRef.current()
                    el.style.transition = ''
                    el.style.transform = ''
                }, 170)
            } else {
                el.style.transition = 'transform 0.2s ease-out'
                el.style.transform = 'translateY(0)'
                window.setTimeout(() => {
                    el.style.transition = ''
                    el.style.transform = ''
                }, 210)
            }
        }
        attach()
        return () => {
            window.cancelAnimationFrame(raf)
            sheet?.removeEventListener('touchstart', onStart)
            window.removeEventListener('touchmove', onMove)
            window.removeEventListener('touchend', onEnd)
            window.removeEventListener('touchcancel', onEnd)
        }
    }, [anchor, opened])
}
