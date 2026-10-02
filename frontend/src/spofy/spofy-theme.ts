import { createTheme, mergeThemeOverrides } from '@mantine/core'

import { theme as upstreamTheme } from '@shared/constants'

const FONT =
    "'Manrope Variable', 'Manrope Fallback', Manrope, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

export const spofyTheme = mergeThemeOverrides(
    upstreamTheme,
    createTheme({
        fontFamily: FONT,
        headings: { fontFamily: FONT, fontWeight: '700' },
        focusRing: 'auto',
        primaryColor: 'spofy',
        primaryShade: 6,
        colors: {
            spofy: [
                '#eaf0ff',
                '#d3dfff',
                '#a6bfff',
                '#759cff',
                '#4d7ffb',
                '#356df7',
                '#2b63f5',
                '#2052d8',
                '#1a46ba',
                '#123793'
            ]
        },
        radius: { xs: '6px', sm: '10px', md: '12px', lg: '16px', xl: '20px' }
    })
)
