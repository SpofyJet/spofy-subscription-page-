/**
 * The bot opens this page as a Telegram Mini App. On iOS a Mini App starts as a sheet over part
 * of the screen while the page is laid out at full height, so its lower part sits below the
 * screen edge: a guide unfolded there looks like a dead tap. So ask Telegram for the full height
 * at once, and keep the height Telegram reports as visible for the scroll helpers.
 * Raw Mini App events (no telegram-web-app.js); outside Telegram all of this does nothing.
 */
type TelegramWindow = Window & {
    Telegram?: { WebView?: { receiveEvent?: (type: string, data: unknown) => void } }
    TelegramWebviewProxy?: { postEvent: (type: string, data: string) => void }
}

const w = window as TelegramWindow
let viewport: null | number = null

export const telegramViewportHeight = () => viewport

const inTelegram = () =>
    !!w.TelegramWebviewProxy || /[#&]tgWebApp(Data|Version|Platform)=/.test(window.location.hash)

function post(type: string, data: object = {}): void {
    try {
        if (w.TelegramWebviewProxy) w.TelegramWebviewProxy.postEvent(type, JSON.stringify(data))
        else if (window.parent !== window)
            window.parent.postMessage(
                JSON.stringify({ eventType: type, eventData: data }),
                'https://web.telegram.org'
            )
    } catch {
        // an old client or not Telegram at all: the page works as before
    }
}

export function setupTelegramView(): void {
    if (!inTelegram()) return
    const webView = (w.Telegram ??= {}).WebView ?? (w.Telegram.WebView = {})
    const previous = webView.receiveEvent
    webView.receiveEvent = (type, data) => {
        const height = (data as { height?: unknown } | null)?.height
        if (type === 'viewport_changed' && typeof height === 'number' && height > 0) viewport = height
        previous?.(type, data)
    }
    post('web_app_ready')
    post('web_app_expand')
    post('web_app_request_viewport')
}
