import { Menu } from '@mantine/core'
import { TSubscriptionPageLanguageCode } from '@remnawave/subscription-page-types'
// deep import: the package entry is CommonJS and pulls in every zod schema
import { getLanguageInfo } from '@remnawave/subscription-page-types/build/backend/constants'
import { IconCheck, IconChevronDown, IconUserCircle } from '@tabler/icons-react'
import clsx from 'clsx'

import { useAppConfig, useAppConfigStoreActions, useCurrentLang } from '@entities/app-config-store'

import { useSpofyT } from '../i18n'
import { SpofyShield } from '../spofy-shield'
import classes from '../spofy.module.css'

export const isTelegramLink = (url: null | string) =>
    !!url && /^https?:\/\/(t\.me|telegram\.me)\//i.test(url)

/**
 * Brand on the left; on the right whose page this is (the Telegram nickname the bot writes into
 * the panel's user description) and the language. Support lives in one place — the bottom of the page.
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
                <SpofyShield className={classes.brandMark} />
                <span className={classes.brandName}>{title}</span>
            </span>
            <div className={classes.topActions}>
                {account && (
                    <span className={classes.account} title={t('stAccount', { name: account })}>
                        <IconUserCircle aria-hidden size={18} stroke={1.9} />
                        <span className={classes.accountName}>{account}</span>
                    </span>
                )}
                {config.locales.length > 1 && (
                    <LanguageMenu
                        currentLang={currentLang}
                        label={t('language')}
                        locales={config.locales}
                        onChange={setLanguage}
                    />
                )}
            </div>
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

    return (
        <Menu
            classNames={{ dropdown: classes.menuDropdown, item: classes.menuItem }}
            position="bottom-end"
            width={190}
            withinPortal
        >
            <Menu.Target>
                <button
                    aria-label={`${label}: ${getLanguageInfo(currentLang)?.nativeName ?? currentLang}`}
                    className={clsx(classes.pill, classes.pillCompact)}
                    type="button"
                >
                    {currentLang.toUpperCase()}
                    <IconChevronDown aria-hidden size={14} stroke={2.25} />
                </button>
            </Menu.Target>
            <Menu.Dropdown>
                {locales.map((locale) => (
                    <Menu.Item
                        aria-current={locale === currentLang ? 'true' : undefined}
                        className={clsx(locale === currentLang && classes.menuItemActive)}
                        key={locale}
                        lang={locale}
                        onClick={() => onChange(locale)}
                        rightSection={
                            locale === currentLang ? (
                                <IconCheck aria-hidden size={16} stroke={2.5} />
                            ) : null
                        }
                    >
                        {getLanguageInfo(locale)?.nativeName ?? locale}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    )
}
