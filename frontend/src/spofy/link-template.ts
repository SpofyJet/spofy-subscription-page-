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

/** Re-render once the crypto library has loaded, if any of these links needs it. */
export function useLinkTemplates(templates: string[]): void {
    const [, rerender] = useState(0)
    const key = templates.join('\n')
    useEffect(() => {
        if (crypto || !templates.some((t) => CRYPT.test(t))) return
        let alive = true
        loadCrypto().then(() => alive && rerender((n) => n + 1))
        return () => {
            alive = false
        }
    }, [key])
}
