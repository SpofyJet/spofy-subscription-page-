import { useEffect, useState } from 'react'

/** QR code as a data URL; the generator (uqr) is downloaded only when a QR is first shown. */
export function useQrDataUrl(text: null | string): string {
    const [src, setSrc] = useState('')
    useEffect(() => {
        if (!text) return
        let alive = true
        import('uqr').then(({ renderSVG }) => {
            if (!alive) return
            const svg = renderSVG(text, { whiteColor: '#FFFFFF', blackColor: '#0B1220' })
            setSrc(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`)
        })
        return () => {
            alive = false
        }
    }, [text])
    return text ? src : ''
}
