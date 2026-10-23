import { useEffect, useRef, useState } from 'react'

/**
 * Copy text, and say honestly whether it worked.
 *
 * 1. The Clipboard API — not there at all in some in-app browsers (Telegram's on some phones:
 *    `navigator.clipboard` is undefined, which used to throw and do nothing).
 * 2. The old `execCommand('copy')` on a temporary text field — works in most of those browsers.
 * 3. Neither: `false`, and the caller shows the link in a field the person can select by hand.
 */
export async function copyText(text: string): Promise<boolean> {
    try {
        if (window.isSecureContext && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return true
        }
    } catch {
        // denied or unavailable: try the old way
    }
    return legacyCopy(text)
}

function legacyCopy(text: string): boolean {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    // 16px: an iPhone zooms the page into any smaller text field it focuses
    field.style.cssText =
        'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px'
    document.body.appendChild(field)
    const selection = document.getSelection()
    const kept = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
    try {
        // iPhone selects a text field only through a range on an editable element
        field.contentEditable = 'true'
        field.readOnly = false
        const range = document.createRange()
        range.selectNodeContents(field)
        selection?.removeAllRanges()
        selection?.addRange(range)
        field.setSelectionRange(0, text.length)
        field.select()
        return document.execCommand('copy')
    } catch {
        return false
    } finally {
        field.remove()
        if (kept && selection) {
            selection.removeAllRanges()
            selection.addRange(kept)
        }
    }
}

/**
 * Copy state for one or several buttons: which one just copied (for «Скопировано» ✓) and which
 * one could not (to show the link for copying by hand).
 */
export function useCopy() {
    const [copied, setCopied] = useState<null | string>(null)
    const [failed, setFailed] = useState<null | string>(null)
    const timer = useRef<number | undefined>(undefined)
    useEffect(() => () => window.clearTimeout(timer.current), [])

    const copy = async (text: string, key: string): Promise<boolean> => {
        const ok = await copyText(text)
        window.clearTimeout(timer.current)
        if (ok) {
            setFailed(null)
            setCopied(key)
            timer.current = window.setTimeout(() => setCopied(null), 2_500)
        } else {
            setCopied(null)
            setFailed(key)
        }
        return ok
    }
    return { copied, copy, failed }
}
