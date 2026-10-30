import { useEffect, useState } from 'react'

/**
 * Same result as upstream `TemplateEngine.formatWithMetaInfo`, but the Happ crypto library
 * (jsencrypt, ~60 KB) is loaded only when a link actually uses {{HAPP_CRYPT3_LINK}} /
 * {{HAPP_CRYPT4_LINK}} — the Spofy config does not, so the page never downloads it.
 */
type TCrypto = typeof import('@kastov/cryptohapp')

const CRYPT = /\{\{HAPP_CRYPT[34]_LINK\}\}/
let crypto: null | TCrypto = null
let loading: null | Promise<TCrypto> = null

const loadCrypto = () =>
    (loading ??= import('@kastov/cryptohapp').then((module) => (crypto = module)))

/** null while the crypto library is still loading for a link that needs it */
export function formatLink(
    template: string,
    meta: { subscriptionUrl: string; username: string }
): null | string {
    if (CRYPT.test(template) && !crypto) return null
    const values: Record<string, () => string | undefined> = {
        USERNAME: () => meta.username,
        SUBSCRIPTION_LINK: () => meta.subscriptionUrl,
        HAPP_CRYPT3_LINK: () =>
            crypto?.createHappCryptoLink(meta.subscriptionUrl, 'v3', true) || 'unknown',
        HAPP_CRYPT4_LINK: () =>
            crypto?.createHappCryptoLink(meta.subscriptionUrl, 'v4', true) || 'unknown'
    }
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key]?.() ?? match)
}

/** Load encrypted-link support on demand and expose an honest loading/error state. */
export function useLinkTemplates(templates: string[]): 'error' | 'loading' | 'ready' {
    const needed = templates.some((t) => CRYPT.test(t))
    const key = templates.join('\n')
    const [result, setResult] = useState<{ key: string; status: 'error' | 'ready' } | null>(null)
    useEffect(() => {
        if (!needed || crypto) return
        let alive = true
        loadCrypto()
            .then(() => alive && setResult({ key, status: 'ready' }))
            .catch(() => alive && setResult({ key, status: 'error' }))
        return () => {
            alive = false
        }
    }, [key, needed])
    if (!needed || crypto) return 'ready'
    return result?.key === key ? result.status : 'loading'
}
