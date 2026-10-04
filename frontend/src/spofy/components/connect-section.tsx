import { Menu } from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import {
    TSubscriptionPageAppConfig,
    TSubscriptionPageButtonConfig,
    TSubscriptionPageLanguageCode,
    TSubscriptionPageLocalizedText,
    TSubscriptionPagePlatformKey
} from '@remnawave/subscription-page-types'
import {
    IconCheck,
    IconChevronDown,
    IconDownload,
    IconListNumbers,
    IconQrcode
} from '@tabler/icons-react'
import clsx from 'clsx'
import { useId, useMemo, useRef, useState } from 'react'

import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { vibrate } from '@shared/utils/vibrate'

import { useAppConfig } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { getAppLogo } from '../app-logos'
import { PLATFORM_ORDER } from '../format'
import { useSpofyT } from '../i18n'
import { formatLink, useLinkTemplates } from '../link-template'
import { prefs } from '../prefs'
import { useQrStore } from '../qr-store'
import classes from '../spofy.module.css'

type TButton = TSubscriptionPageButtonConfig

/** Panel config colour names → RGB (same palette as the cabinet's colorParser). */
const ICON_COLORS: Record<string, string> = {
    cyan: '34, 211, 238',
    teal: '32, 201, 151',
    green: '64, 192, 87',
    lime: '130, 201, 30',
    yellow: '250, 176, 5',
    orange: '253, 126, 20',
    red: '250, 82, 82',
    pink: '230, 73, 128',
    grape: '190, 75, 219',
    violet: '151, 117, 250',
    indigo: '92, 124, 250',
    blue: '34, 139, 230'
}

const TV_PLATFORMS: TSubscriptionPagePlatformKey[] = ['androidTV', 'appleTV']

function localized(
    text: TSubscriptionPageLocalizedText | undefined,
    lang: TSubscriptionPageLanguageCode
): string {
    if (!text) return ''
    return text[lang] ?? text.en ?? text.ru ?? Object.values(text)[0] ?? ''
}

function SvgIcon({ className, svg }: { className: string; svg: string | undefined }) {
    if (!svg) return <span aria-hidden className={className} />
    return <span aria-hidden className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}

function AppIcon({ app }: { app: TSubscriptionPageAppConfig }) {
    const { svgLibrary } = useAppConfig()
    const logo = getAppLogo(app.name)

    if (logo?.src) {
        return (
            <span aria-hidden className={clsx(classes.appIcon, classes.appIconImage)}>
                <img alt="" decoding="async" src={logo.src} />
            </span>
        )
    }
    return (
        <span
            aria-hidden
            className={classes.appIcon}
            dangerouslySetInnerHTML={{
                __html: app.svgIconKey ? (svgLibrary[app.svgIconKey] ?? '') : ''
            }}
            style={logo?.tile ? { background: logo.tile } : undefined}
        />
    )
}

/** The buttons that become the one-tap actions of the setup card. */
function pickHeroButtons(app: TSubscriptionPageAppConfig) {
    const all = app.blocks.flatMap((block) => block.buttons)
    return {
        install: all.find((button) => button.type === 'external'),
        add:
            all.find((button) => button.type === 'subscriptionLink') ??
            all.find((button) => button.type === 'copyButton')
    }
}

export function ConnectSection({
    detected
}: {
    detected: TSubscriptionPagePlatformKey | undefined
}) {
    const config = useAppConfig()
    const subscription = useSubscription()
    const { t, lang } = useSpofyT()
    const headingId = useId()

    const available = PLATFORM_ORDER.filter((key) => (config.platforms[key]?.apps.length ?? 0) > 0)

    const [platform, setPlatform] = useState<TSubscriptionPagePlatformKey | undefined>(() => {
        const remembered = prefs.platform() as TSubscriptionPagePlatformKey | undefined
        if (remembered && available.includes(remembered)) return remembered
        return detected && available.includes(detected) ? detected : available[0]
    })
    const [picked, setPicked] = useState<{ name: string; platform: string } | null>(() =>
        platform ? { platform, name: prefs.app(platform) ?? '' } : null
    )
    const appRefs = useRef(new Map<number, HTMLButtonElement | null>())

    const subscriptionUrl = useMemo(
        () => constructSubscriptionUrl(window.location.href, subscription.user.shortUuid),
        [subscription.user.shortUuid]
    )

    const apps = platform ? (config.platforms[platform]?.apps ?? []) : []
    const featuredIndex = Math.max(
        0,
        apps.findIndex((app) => app.featured)
    )
    const pickedIndex =
        picked && picked.platform === platform
            ? apps.findIndex((app) => app.name === picked.name)
            : -1
    const appIndex = pickedIndex >= 0 ? pickedIndex : featuredIndex

    if (!platform || available.length === 0 || apps.length === 0) return null
    const app = apps[appIndex]!
    const platformConfig = config.platforms[platform]!

    const selectPlatform = (key: TSubscriptionPagePlatformKey) => {
        vibrate('selection')
        setPlatform(key)
        prefs.setPlatform(key)
    }
    const selectApp = (index: number, focus = false) => {
        vibrate('selection')
        setPicked({ platform, name: apps[index]!.name })
        prefs.setApp(platform, apps[index]!.name)
        if (focus) appRefs.current.get(index)?.focus()
    }
    const onAppKeys = (event: React.KeyboardEvent) => {
        const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
        if (!delta) return
        event.preventDefault()
        selectApp((appIndex + delta + apps.length) % apps.length, true)
    }

    return (
        <section aria-labelledby={headingId} className={clsx(classes.card, classes.connect)}>
            <div className={classes.connectHead}>
                <h2 className={classes.sectionTitle} id={headingId}>
                    {t('connectA')}{' '}
                    <span className={clsx(classes.glow, classes.glow_accent)}>{t('connectB')}</span>
                </h2>

                {available.length > 1 && (
                    <Menu
                        classNames={{ dropdown: classes.menuDropdown, item: classes.menuItem }}
                        position="bottom-end"
                        width={210}
                        withinPortal
                    >
                        <Menu.Target>
                            <button
                                aria-label={`${t('platform')}: ${localized(platformConfig.displayName, lang)}`}
                                className={classes.platformButton}
                                type="button"
                            >
                                <SvgIcon
                                    className={classes.platformIcon}
                                    svg={config.svgLibrary[platformConfig.svgIconKey]}
                                />
                                <span className={classes.platformName}>
                                    {localized(platformConfig.displayName, lang)}
                                </span>
                                <IconChevronDown aria-hidden size={16} stroke={2.25} />
                            </button>
                        </Menu.Target>
                        <Menu.Dropdown>
                            {available.map((key) => {
                                const item = config.platforms[key]!
                                const current = key === platform
                                return (
                                    <Menu.Item
                                        aria-current={current ? 'true' : undefined}
                                        className={clsx(current && classes.menuItemActive)}
                                        key={key}
                                        leftSection={
                                            <SvgIcon
                                                className={classes.platformIcon}
                                                svg={config.svgLibrary[item.svgIconKey]}
                                            />
                                        }
                                        onClick={() => selectPlatform(key)}
                                        rightSection={
                                            current ? (
                                                <IconCheck aria-hidden size={16} stroke={2.5} />
                                            ) : null
                                        }
                                    >
                                        {localized(item.displayName, lang)}
                                    </Menu.Item>
                                )
                            })}
                        </Menu.Dropdown>
                    </Menu>
                )}
            </div>

            <div
                aria-label={t('app')}
                className={clsx(classes.appGrid, apps.length === 1 && classes.appGridSingle)}
                onKeyDown={onAppKeys}
                role="radiogroup"
            >
                {apps.map((item, index) => {
                    const checked = index === appIndex
                    return (
                        <button
                            aria-checked={checked}
                            className={classes.appTile}
                            key={`${platform}-${item.name}`}
                            onClick={() => selectApp(index)}
                            ref={(el) => {
                                appRefs.current.set(index, el)
                            }}
                            role="radio"
                            tabIndex={checked ? 0 : -1}
                            type="button"
                        >
                            <AppIcon app={item} />
                            <span className={classes.appTileText}>
                                <span className={classes.appTileName}>{item.name}</span>
                                <span
                                    className={clsx(
                                        classes.appTileCaption,
                                        item.featured && classes.appTileFeatured
                                    )}
                                >
                                    {item.featured ? t('recommended') : t('alsoWorks')}
                                </span>
                            </span>
                        </button>
                    )
                })}
            </div>

            <AppSetup
                app={app}
                isTv={TV_PLATFORMS.includes(platform)}
                key={`${platform}-${app.name}`}
                subscriptionUrl={subscriptionUrl}
                username={subscription.user.username}
            />
        </section>
    )
}

function AppSetup(props: {
    app: TSubscriptionPageAppConfig
    isTv: boolean
    subscriptionUrl: string
    username: string
}) {
    const { app, isTv, subscriptionUrl, username } = props
    const { svgLibrary } = useAppConfig()
    const { t, lang } = useSpofyT()
    const clipboard = useClipboard({ timeout: 2_000 })
    const openQr = useQrStore((state) => state.setOpen)
    const [copiedButton, setCopiedButton] = useState<TButton | null>(null)
    const [stepsOpen, setStepsOpen] = useState(false)
    const stepsId = useId()

    const { install, add } = pickHeroButtons(app)

    useLinkTemplates(app.blocks.flatMap((block) => block.buttons.map((button) => button.link)))
    /** null while the crypto library is still loading for a link that needs it */
    const formatOrNull = (button: TButton) =>
        button.type === 'external'
            ? button.link
            : formatLink(button.link, { username, subscriptionUrl })
    const format = (button: TButton) => formatOrNull(button) ?? '#'

    const renderButton = (
        button: TButton,
        variant: 'ghost' | 'primary' | 'secondary',
        label?: string
    ) => {
        const text = label ?? localized(button.text, lang)
        const className = clsx(
            classes.btn,
            variant === 'primary' && clsx(classes.btnPrimary, classes.btnGlow),
            variant === 'secondary' && classes.btnSecondary,
            variant === 'ghost' && classes.btnGhost
        )
        const icon =
            variant === 'ghost' ? (
                <SvgIcon className={classes.btnIcon} svg={svgLibrary[button.svgIconKey]} />
            ) : variant === 'secondary' ? (
                <IconDownload aria-hidden size={19} stroke={2} />
            ) : null

        if (button.type === 'copyButton') {
            const isCopied = clipboard.copied && copiedButton === button
            return (
                <button
                    className={className}
                    onClick={() => {
                        const link = formatOrNull(button)
                        if (link === null) return // never copy a placeholder
                        clipboard.copy(link)
                        setCopiedButton(button)
                        vibrate('tap')
                    }}
                    type="button"
                >
                    {isCopied ? <IconCheck aria-hidden size={19} stroke={2.25} /> : icon}
                    <span aria-live="polite">{isCopied ? t('copied') : text}</span>
                </button>
            )
        }

        const isExternal = button.type === 'external'
        return (
            <a
                className={className}
                href={format(button)}
                onClick={() => vibrate('tap')}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                target={isExternal ? '_blank' : undefined}
                title={label && label !== text ? localized(button.text, lang) : undefined}
            >
                {icon}
                {text}
            </a>
        )
    }

    return (
        <div className={classes.setup}>
            {(install || add) && (
                <div className={classes.setupButtons}>
                    {install && renderButton(install, 'secondary', t('install'))}
                    {add &&
                        renderButton(
                            add,
                            'primary',
                            add.type === 'subscriptionLink' ? t('addSubscription') : undefined
                        )}
                </div>
            )}

            {isTv && (
                <button className={classes.tvHint} onClick={() => openQr(true)} type="button">
                    <span aria-hidden className={classes.iconSquare}>
                        <IconQrcode size={18} stroke={2} />
                    </span>
                    <span>{t('tvHint')}</span>
                </button>
            )}

            <button
                aria-controls={stepsId}
                aria-expanded={stepsOpen}
                className={classes.disclosure}
                onClick={() => setStepsOpen((open) => !open)}
                type="button"
            >
                <span aria-hidden className={classes.iconSquare}>
                    <IconListNumbers size={18} stroke={2} />
                </span>
                <span className={clsx(classes.disclosureText, classes.disclosureInline)}>
                    {t('instructions')}
                    <span className={classes.disclosureMeta}>
                        {t('stepsCount', { n: app.blocks.length })}
                    </span>
                </span>
                <IconChevronDown
                    aria-hidden
                    className={clsx(classes.chevron, stepsOpen && classes.chevronOpen)}
                    size={18}
                    stroke={2.25}
                />
            </button>

            <ol aria-label={t('howTo')} className={classes.steps} hidden={!stepsOpen} id={stepsId}>
                {app.blocks.map((block, index) => {
                    const extra = block.buttons.filter(
                        (button) => button !== install && button !== add
                    )
                    const rgb = ICON_COLORS[block.svgIconColor ?? ''] ?? ICON_COLORS.cyan
                    return (
                        <li
                            className={classes.step}
                            key={index}
                            style={{ '--step-rgb': rgb } as React.CSSProperties}
                        >
                            <span aria-hidden className={classes.stepIcon}>
                                {block.svgIconKey && svgLibrary[block.svgIconKey] ? (
                                    <span
                                        className={classes.stepIconGlyph}
                                        dangerouslySetInnerHTML={{
                                            __html: svgLibrary[block.svgIconKey]!
                                        }}
                                    />
                                ) : (
                                    <span className={classes.num}>{index + 1}</span>
                                )}
                            </span>
                            <div className={classes.stepBody}>
                                <span className={classes.stepKicker}>
                                    {t('stepOf', { n: index + 1, total: app.blocks.length })}
                                </span>
                                <p
                                    className={classes.stepTitle}
                                    dangerouslySetInnerHTML={{
                                        __html: localized(block.title, lang)
                                    }}
                                />
                                <p
                                    className={classes.stepText}
                                    dangerouslySetInnerHTML={{
                                        __html: localized(block.description, lang)
                                    }}
                                />
                                {extra.length > 0 && (
                                    <div className={classes.stepButtons}>
                                        {extra.map((button, i) => (
                                            <span key={i}>{renderButton(button, 'ghost')}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}
