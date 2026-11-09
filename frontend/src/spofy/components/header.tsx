import { TSubscriptionPageLanguageCode } from '@remnawave/subscription-page-types'
// deep import: the package entry is CommonJS and pulls in every zod schema
import { getLanguageInfo } from '@remnawave/subscription-page-types/build/backend/constants'
import { IconCheck, IconWorld } from '@tabler/icons-react'
import clsx from 'clsx'
import { KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react'

import { useAppConfig, useAppConfigStoreActions, useCurrentLang } from '@entities/app-config-store'

import { ensureLocale, useSpofyT } from '../i18n'
import { SpofyShield } from '../spofy-shield'
import classes from '../spofy.module.css'

export const isTelegramLink = (url: null | string) =>
    !!url && /^https?:\/\/(t\.me|telegram\.me)\//i.test(url)

/**
 * Like the cabinet's header: the brand with whose page this is under it (the Telegram nickname
 * the bot writes into the panel's user description), and one small button on the right — the
 * language. Support lives in one place — the bottom of the page.
 */
export function Header({ account }: { account: null | string }) {
    const config = useAppConfig()
    const currentLang = useCurrentLang()
    const { setLanguage } = useAppConfigStoreActions()
    const { t } = useSpofyT()
    const title = config.brandingSettings.title || 'Spofy VPN'

    return (
        <header className={classes.topBar}>
            <span className={classes.brand}>
                <span aria-hidden className={classes.brandTile}>
                    <SpofyShield className={classes.brandMark} />
                </span>
                <span className={classes.brandText}>
                    <span className={classes.brandName}>{title}</span>
                    {account && (
                        <span
                            className={classes.accountName}
                            title={t('stAccount', { name: account })}
                        >
                            {account}
                        </span>
                    )}
                </span>
            </span>
            {config.locales.length > 1 && (
                <LanguageMenu
                    currentLang={currentLang}
                    label={t('language')}
                    locales={config.locales}
                    onChange={(lang) => void ensureLocale(lang).then(() => setLanguage(lang))}
                />
            )}
        </header>
    )
}

function LanguageMenu(props: {
    currentLang: TSubscriptionPageLanguageCode
    label: string
    locales: TSubscriptionPageLanguageCode[]
    onChange: (lang: TSubscriptionPageLanguageCode) => void
}) {
    const { currentLang, label, locales, onChange } = props
    const [open, setOpen] = useState(false)
    const root = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false)
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            setOpen(false)
            trigger.current?.focus()
        }
        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('pointerdown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        const items = [
            ...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
        ]
        const step = event.key === 'ArrowDown' ? 1 : -1
        const current = items.indexOf(document.activeElement as HTMLElement)
        const next = current === -1 && step === -1 ? items.length - 1 : current + step
        items[(next + items.length) % items.length]?.focus()
    }

    return (
        <div className={classes.menuRoot} onKeyDown={moveFocus} ref={root}>
            <button
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={`${label}: ${getLanguageInfo(currentLang)?.nativeName ?? currentLang}`}
                className={clsx(classes.pill, classes.pillCompact)}
                onClick={() => setOpen((value) => !value)}
                ref={trigger}
                type="button"
            >
                <IconWorld aria-hidden size={16} stroke={1.9} />
                {currentLang.toUpperCase()}
            </button>
            {open && (
                <div className={classes.menuDropdown} role="menu">
                    {locales.map((locale) => (
                        <button
                            aria-current={locale === currentLang ? 'true' : undefined}
                            className={clsx(
                                classes.menuItem,
                                locale === currentLang && classes.menuItemActive
                            )}
                            key={locale}
                            lang={locale}
                            onClick={() => {
                                setOpen(false)
                                onChange(locale)
                            }}
                            role="menuitem"
                            type="button"
                        >
                            {getLanguageInfo(locale)?.nativeName ?? locale}
                            {locale === currentLang && (
                                <IconCheck aria-hidden size={16} stroke={2.5} />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
