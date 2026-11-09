/** Runs work once the browser is free; Safari has no requestIdleCallback. */
export function whenIdle(work: () => void): void {
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(work, { timeout: 3000 })
        return
    }
    window.setTimeout(work, 300)
}
