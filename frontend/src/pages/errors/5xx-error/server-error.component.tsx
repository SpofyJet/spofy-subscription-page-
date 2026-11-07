import { SpofyFallback } from '../../../spofy/spofy-fallback'

/** Crash screen behind the error boundary: Spofy look, Russian, reload + support. */
export function ErrorPageComponent() {
    return <SpofyFallback kind="crash" />
}
