import { SpofyShield } from './spofy-shield'
import { useSpofyStore } from './spofy-store'
import classes from './spofy.module.css'

const SUPPORT_URL = 'https://t.me/spofysup'

const TEXT = {
    ru: {
        crash: {
            title: 'Страница не открылась',
            text: 'Что-то пошло не так. Обновите страницу — обычно этого хватает.'
        },
        stalled: {
            title: 'Не удалось загрузить',
            text: 'Похоже, пропал интернет или сеть слишком медленная. Проверьте подключение и обновите страницу.'
        },
        reload: 'Обновить',
        support: 'Написать в поддержку'
    },
    en: {
        crash: {
            title: 'The page did not open',
            text: 'Something went wrong. Reload the page — that usually helps.'
        },
        stalled: {
            title: 'Could not load',
            text: 'The connection seems to be lost or too slow. Check it and reload the page.'
        },
        reload: 'Reload',
        support: 'Contact support'
    }
} as const

/** Russian unless the browser clearly prefers another language we have. */
function pickText() {
    const langs =
        typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
    const first = langs.find(Boolean)?.toLowerCase() ?? 'ru'
    return first.startsWith('en') ? TEXT.en : TEXT.ru
}

/**
 * Spofy screen for «the page could not be shown»: a crash caught by the error boundary or a
 * config/data load that never finished. Same look as the page itself, never a blank shield.
 */
export function SpofyFallback({ kind }: { kind: 'crash' | 'stalled' }) {
    const t = pickText()
    const supportUrl = useSpofyStore.getState().data.supportUrl ?? SUPPORT_URL

    return (
        <div className={classes.fallback} role="alert">
            <SpofyShield className={classes.fallbackLogo} />
            <h1 className={classes.fallbackTitle}>{t[kind].title}</h1>
            <p className={classes.fallbackText}>{t[kind].text}</p>
            <div className={classes.fallbackActions}>
                <button
                    className={`${classes.btn} ${classes.btnPrimary}`}
                    onClick={() => window.location.reload()}
                    type="button"
                >
                    {t.reload}
                </button>
                <a
                    className={`${classes.btn} ${classes.btnSecondary}`}
                    href={supportUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    {t.support}
                </a>
            </div>
        </div>
    )
}
