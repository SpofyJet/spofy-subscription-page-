// The Mantine styles the QR and purchase windows use. Loaded with those windows, not with the page.
import '@mantine/core/styles/default-css-variables.layer.css'
import '@mantine/core/styles/global.layer.css'
import '@mantine/core/styles/UnstyledButton.layer.css'
import '@mantine/core/styles/VisuallyHidden.layer.css'
import '@mantine/core/styles/Paper.layer.css'
import '@mantine/core/styles/CloseButton.layer.css'
import '@mantine/core/styles/Overlay.layer.css'
import '@mantine/core/styles/ModalBase.layer.css'
import '@mantine/core/styles/Modal.layer.css'
import '@mantine/core/styles/Drawer.layer.css'
import '@mantine/core/styles/ScrollArea.layer.css'
import { MantineProvider, v8CssVariablesResolver } from '@mantine/core'
import { ReactNode } from 'react'

import { spofyTheme } from './spofy-theme'

export function MantineScope({ children }: { children: ReactNode }) {
    return (
        <MantineProvider
            cssVariablesResolver={v8CssVariablesResolver}
            defaultColorScheme="auto"
            theme={spofyTheme}
        >
            {children}
        </MantineProvider>
    )
}
