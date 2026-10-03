import { createTheme } from '@mantine/core'

// Built without the upstream theme: its component overrides (inputs, selects, tooltips,
// tables...) pulled ~60 KB of unused Mantine components into the first load. Only the
// values the Spofy page relies on are kept here.
const FONT =
    "'Manrope Variable', 'Manrope Fallback', Manrope, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

export const spofyTheme = createTheme({
    cursorType: 'pointer',
    white: '#ffffff',
    black: '#24292f',
    defaultRadius: 'md',
    fontSmoothing: true,
    breakpoints: { xs: '25em', sm: '30em', md: '48em', lg: '64em', xl: '80em' },
    fontFamily: FONT,
    headings: { fontFamily: FONT, fontWeight: '700' },
    focusRing: 'auto',
    primaryColor: 'spofy',
    primaryShade: 6,
    colors: {
        dark: [
            '#c9d1d9',
            '#b1bac4',
            '#8b949e',
            '#6e7681',
            '#484f58',
            '#30363d',
            '#21262d',
            '#161b22',
            '#0d1117',
            '#010409'
        ],
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
