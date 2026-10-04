// Only the Mantine styles the Spofy page uses (the full bundle was 224 KB of render-blocking CSS).
import '@mantine/core/styles/baseline.layer.css'
import '@mantine/core/styles/default-css-variables.layer.css'
import '@mantine/core/styles/global.layer.css'
import '@mantine/core/styles/UnstyledButton.layer.css'
import '@mantine/core/styles/VisuallyHidden.layer.css'
import '@mantine/core/styles/Paper.layer.css'
import '@mantine/core/styles/Popover.layer.css'
import '@mantine/core/styles/Menu.layer.css'
import '@mantine/core/styles/CloseButton.layer.css'
import '@mantine/core/styles/Overlay.layer.css'
import '@mantine/core/styles/ModalBase.layer.css'
import '@mantine/core/styles/Modal.layer.css'
import '@mantine/core/styles/Drawer.layer.css'
import '@mantine/core/styles/ScrollArea.layer.css'
// The error-boundary fallback page (reachable from every route) uses these.
import '@mantine/core/styles/Button.layer.css'
import '@mantine/core/styles/Container.layer.css'
import '@mantine/core/styles/Group.layer.css'
import '@mantine/core/styles/Text.layer.css'
import '@mantine/core/styles/Title.layer.css'
import './global.css'
import { DirectionProvider, MantineProvider, v8CssVariablesResolver } from '@mantine/core'
import { enableMainThreadBlocking } from 'ios-vibrator-pro-max'

import { Router } from './app/router/router'
import { spofyTheme } from './spofy'

enableMainThreadBlocking(false)

export function App() {
    return (
        <DirectionProvider>
            <MantineProvider
                cssVariablesResolver={v8CssVariablesResolver}
                defaultColorScheme="auto"
                theme={spofyTheme}
            >
                <Router />
            </MantineProvider>
        </DirectionProvider>
    )
}
