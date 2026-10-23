/**
 * Bring a block into view so that a tap always visibly does something.
 *
 * On a phone a plain smooth `scrollIntoView` is not reliable: the finger's momentum scroll
 * cancels it, and right after a window (Drawer) closes the page scroll is still locked for a
 * moment. So: wait for the lock to go, scroll, check where we ended up and jump if needed — and
 * flash the block, which also answers the tap when it was already on screen.
 */
const GAP = 12
const flashTimers = new WeakMap<HTMLElement, number>()

const locked = () =>
    document.body.hasAttribute('data-scroll-locked') ||
    getComputedStyle(document.body).overflow === 'hidden'

const targetTop = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY - GAP

export function revealBlock(el: HTMLElement | null, options: { flash?: boolean } = {}): void {
    if (!el) return
    const run = (attempt: number) => {
        if (locked() && attempt < 10) {
            window.setTimeout(() => run(attempt + 1), 60)
            return
        }
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: targetTop(el), behavior: reduce ? 'auto' : 'smooth' })
        window.setTimeout(() => {
            const maxTop = document.documentElement.scrollHeight - window.innerHeight
            const want = Math.min(Math.max(0, targetTop(el)), maxTop)
            // the smooth scroll was swallowed (momentum, lock): go there at once
            if (Math.abs(window.scrollY - want) > 24)
                window.scrollTo({ top: want, behavior: 'auto' })
        }, 700)
        if (options.flash !== false) {
            window.clearTimeout(flashTimers.get(el))
            delete el.dataset.flash
            // restart the animation even when tapped twice in a row
            void el.offsetWidth
            el.dataset.flash = ''
            flashTimers.set(
                el,
                window.setTimeout(() => delete el.dataset.flash, 1_600)
            )
        }
    }
    run(0)
}
