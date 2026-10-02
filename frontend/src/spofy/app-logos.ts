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

export const getAppLogo = (name: string): IAppLogo | undefined => LOGOS[name.trim().toLowerCase()]
