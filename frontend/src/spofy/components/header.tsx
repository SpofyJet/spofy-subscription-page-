import { Menu } from '@mantine/core'
import { TSubscriptionPageLanguageCode } from '@remnawave/subscription-page-types'
// deep import: the package entry is CommonJS and pulls in every zod schema
import { getLanguageInfo } from '@remnawave/subscription-page-types/build/backend/constants'
import { IconCheck, IconWorld } from '@tabler/icons-react'
import clsx from 'clsx'

import { useAppConfig, useAppConfigStoreActions, useCurrentLang } from '@entities/app-config-store'

import { useSpofyT } from '../i18n'
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
                    onChange={setLanguage}
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
                    <IconWorld aria-hidden size={16} stroke={1.9} />
                    {currentLang.toUpperCase()}
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
