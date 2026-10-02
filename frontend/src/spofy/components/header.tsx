import { Menu } from '@mantine/core'
import { TSubscriptionPageLanguageCode } from '@remnawave/subscription-page-types'
// deep import: the package entry is CommonJS and pulls in every zod schema
import { getLanguageInfo } from '@remnawave/subscription-page-types/build/backend/constants'
import { IconBrandTelegram, IconChevronDown, IconMessageCircle } from '@tabler/icons-react'
import clsx from 'clsx'

import { useAppConfig, useAppConfigStoreActions, useCurrentLang } from '@entities/app-config-store'

import { useSpofyT } from '../i18n'
import { SpofyShield } from '../spofy-shield'
import classes from '../spofy.module.css'

export function SpofyHeader({ supportUrl }: { supportUrl: null | string }) {
    const config = useAppConfig()
    const currentLang = useCurrentLang()
    const { setLanguage } = useAppConfigStoreActions()
    const { t } = useSpofyT()

    const title = config.brandingSettings.title || 'Spofy VPN'
    const SupportIcon = supportUrl?.includes('t.me') ? IconBrandTelegram : IconMessageCircle

    return (
        <header className={classes.header}>
            <div className={classes.brand}>
                <SpofyShield className={classes.brandLogo} />
                <h1 className={classes.brandName}>{title}</h1>
            </div>

            <div className={classes.headerActions}>
                {config.locales.length > 1 && (
                    <LanguageMenu
                        currentLang={currentLang}
                        label={t('language')}
                        locales={config.locales}
                        onChange={setLanguage}
                    />
                )}
                {supportUrl && (
                    <a
                        aria-label={t('support')}
                        className={classes.iconBtn}
                        href={supportUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                        title={t('support')}
                    >
                        <SupportIcon aria-hidden size={22} stroke={1.75} />
                    </a>
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
            width={180}
            withinPortal
        >
            <Menu.Target>
                <button
                    aria-label={`${label}: ${getLanguageInfo(currentLang)?.nativeName ?? currentLang}`}
                    className={classes.iconBtn}
                    type="button"
                >
                    {currentLang.toUpperCase()}
                    <IconChevronDown aria-hidden size={16} stroke={2} />
                </button>
            </Menu.Target>
            <Menu.Dropdown>
                {locales.map((locale) => {
                    const info = getLanguageInfo(locale)
                    return (
                        <Menu.Item
                            aria-current={locale === currentLang ? 'true' : undefined}
                            className={clsx(locale === currentLang && classes.menuItemActive)}
                            key={locale}
                            lang={locale}
                            onClick={() => onChange(locale)}
                        >
                            {info?.nativeName ?? locale}
                        </Menu.Item>
                    )
                })}
            </Menu.Dropdown>
        </Menu>
    )
}
