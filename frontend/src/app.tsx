// Mantine now loads only with the windows that use it (see spofy/mantine-scope.tsx). The baseline
// stays here: it opens `@layer mantine` first, so the page's own styles always win.
import '@mantine/core/styles/baseline.layer.css'
import './global.css'
import { ErrorBoundary } from 'react-error-boundary'

import { RootLayout } from './app/layouts/root/root.layout'
import { SpofyMainPage } from './spofy'
import { SpofyFallback } from './spofy/spofy-fallback'

export function App() {
    return (
        <ErrorBoundary fallback={<SpofyFallback kind="crash" />}>
            <RootLayout>
                <SpofyMainPage />
            </RootLayout>
        </ErrorBoundary>
    )
}
