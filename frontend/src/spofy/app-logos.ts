import incyLogo from './assets/incy.svg'

/**
 * Real app icons for the app tiles. The panel config only carries monochrome
 * glyphs; these give the tiles the look of the actual app icons.
 *  - INCY: official logo from incy.cc/favicon.svg (identical to the store icon)
 *  - Happ: the store icon is the config's white "H" glyph on black
 */
export interface IAppLogo {
    /** full-colour icon image (replaces the glyph) */
    src?: string
    /** tile background behind a config glyph */
    tile?: string
}

const LOGOS: Record<string, IAppLogo> = {
    incy: { src: incyLogo },
    happ: { tile: '#000000' }
}

/** «Happ», «Happ Proxy», «INCY VPN» → happ / incy */
const appKey = (name: string) =>
    name
        .trim()
        .toLowerCase()
        .split(/[\s\-–—_]+/)[0] ?? ''

export const getAppLogo = (name: string): IAppLogo | undefined => LOGOS[appKey(name)]

/**
 * Apps the page offers, whatever else the panel config lists (owner's decision 22.10.2026:
 * only Happ and INCY). A platform with none of them is not shown. To change: edit this list.
 */
export const ALLOWED_APPS = ['happ', 'incy']

export const isAllowedApp = (name: string) => ALLOWED_APPS.includes(appKey(name))
