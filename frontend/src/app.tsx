import '@mantine/core/styles.layer.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/nprogress/styles.layer.css'
import '@gfazioli/mantine-spinner/styles.css'

import './global.css'
import { spofyTheme } from './spofy'

import { DirectionProvider, MantineProvider, v8CssVariablesResolver } from '@mantine/core'
import { enableMainThreadBlocking } from 'ios-vibrator-pro-max'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { useMediaQuery } from '@mantine/hooks'

import { Router } from './app/router/router'

enableMainThreadBlocking(false)

export function App() {
    const mq = useMediaQuery('(min-width: 40em)')

    return (
        <DirectionProvider>
            <MantineProvider
                cssVariablesResolver={v8CssVariablesResolver}
                defaultColorScheme="auto"
                theme={spofyTheme}
            >
                <ModalsProvider>
                    <Notifications position={mq ? 'top-right' : 'bottom-right'} />

                    <Router />
                </ModalsProvider>
            </MantineProvider>
        </DirectionProvider>
    )
}
