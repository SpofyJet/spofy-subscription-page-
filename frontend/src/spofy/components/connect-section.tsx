import { useClipboard } from '@mantine/hooks'
import {
    TSubscriptionPageAppConfig,
    TSubscriptionPageButtonConfig,
    TSubscriptionPageLanguageCode,
    TSubscriptionPageLocalizedText,
    TSubscriptionPagePlatformKey
} from '@remnawave/subscription-page-types'
import { IconCheck, IconChevronDown, IconDownload, IconPlus } from '@tabler/icons-react'
import clsx from 'clsx'
import { useId, useMemo, useRef, useState } from 'react'

import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { TemplateEngine } from '@shared/utils/template-engine'
import { vibrate } from '@shared/utils/vibrate'

import { useAppConfig } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { getAppLogo } from '../app-logos'
import { PLATFORM_ORDER } from '../format'
import { useSpofyT } from '../i18n'
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

function AppIcon({ app, size }: { app: TSubscriptionPageAppConfig; size: 'lg' | 'sm' }) {
    const { svgLibrary } = useAppConfig()
    const logo = getAppLogo(app.name)
    const className = clsx(classes.appIcon, size === 'sm' && classes.appIconSm)

    if (logo?.src) {
        return (
            <span aria-hidden className={clsx(className, classes.appIconImage)}>
                <img alt="" decoding="async" src={logo.src} />
            </span>
        )
    }
    return (
        <span
            aria-hidden
            className={className}
            dangerouslySetInnerHTML={{
                __html: app.svgIconKey ? (svgLibrary[app.svgIconKey] ?? '') : ''
            }}
            style={logo?.tile ? { background: logo.tile } : undefined}
        />
    )
}

/** The buttons that become the big one-tap actions of the app card. */
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
    const selectId = useId()

    const available = PLATFORM_ORDER.filter((key) => (config.platforms[key]?.apps.length ?? 0) > 0)

    const [platform, setPlatform] = useState<TSubscriptionPagePlatformKey | undefined>(() =>
        detected && available.includes(detected) ? detected : available[0]
    )
    const [picked, setPicked] = useState<{ index: number; platform: string } | null>(null)
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
    const appIndex =
        picked && picked.platform === platform && apps[picked.index] ? picked.index : featuredIndex

    if (!platform || available.length === 0 || apps.length === 0) return null
    const app = apps[appIndex]!

    const selectApp = (index: number, focus = false) => {
        vibrate('selection')
        setPicked({ platform, index })
        if (focus) appRefs.current.get(index)?.focus()
    }
    const onAppKeys = (event: React.KeyboardEvent) => {
        const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
        if (!delta) return
        event.preventDefault()
        selectApp((appIndex + delta + apps.length) % apps.length, true)
    }

    return (
        <section aria-labelledby={headingId} className={classes.section}>
            <div className={classes.sectionHeadRow}>
                <h2 className={classes.sectionTitle} id={headingId}>
                    {t('connectA')}{' '}
                    <span className={clsx(classes.glow, classes.glow_accent)}>{t('connectB')}</span>
                </h2>

                {available.length > 1 && (
                    <div className={classes.platformSelect}>
                        <label className={classes.visuallyHidden} htmlFor={selectId}>
                            {t('platform')}
                        </label>
                        <SvgIcon
                            className={classes.platformSelectIcon}
                            svg={config.svgLibrary[config.platforms[platform]!.svgIconKey]}
                        />
                        <select
                            id={selectId}
                            onChange={(event) => {
                                vibrate('selection')
                                setPlatform(event.target.value as TSubscriptionPagePlatformKey)
                            }}
                            value={platform}
                        >
                            {available.map((key) => (
                                <option key={key} value={key}>
                                    {localized(config.platforms[key]!.displayName, lang)}
                                </option>
                            ))}
                        </select>
                        <IconChevronDown
                            aria-hidden
                            className={classes.platformSelectChevron}
                            size={16}
                            stroke={2.25}
                        />
                    </div>
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
                            <AppIcon app={item} size="lg" />
                            <span className={classes.appTileText}>
                                <span className={classes.appTileName}>{item.name}</span>
                                <span
                                    className={clsx(
                                        classes.appTileCaption,
                                        item.featured && classes.appTileFeatured
                                    )}
                                >
                                    {item.featured && (
                                        <span aria-hidden className={classes.featuredDot} />
                                    )}
                                    {item.featured ? t('recommended') : t('alsoWorks')}
                                </span>
                            </span>
                            <span aria-hidden className={classes.appTileCheck}>
                                {checked && <IconCheck size={14} stroke={3} />}
                            </span>
                        </button>
                    )
                })}
            </div>

            <AppCard
                app={app}
                key={`${platform}-${appIndex}`}
                subscriptionUrl={subscriptionUrl}
                username={subscription.user.username}
            />
        </section>
    )
}

function AppCard(props: {
    app: TSubscriptionPageAppConfig
    subscriptionUrl: string
    username: string
}) {
    const { app, subscriptionUrl, username } = props
    const { svgLibrary } = useAppConfig()
    const { t, lang } = useSpofyT()
    const clipboard = useClipboard({ timeout: 2_000 })
    const [copiedButton, setCopiedButton] = useState<TButton | null>(null)
    const titleId = useId()

    const { install, add } = pickHeroButtons(app)

    const format = (button: TButton) =>
        button.type === 'external'
            ? button.link
            : TemplateEngine.formatWithMetaInfo(button.link, { username, subscriptionUrl })

    const renderButton = (
        button: TButton,
        variant: 'ghost' | 'primary' | 'secondary',
        label?: string
    ) => {
        const text = label ?? localized(button.text, lang)
        const icon =
            variant === 'ghost' ? (
                <SvgIcon className={classes.btnIcon} svg={svgLibrary[button.svgIconKey]} />
            ) : button.type === 'external' ? (
                <IconDownload aria-hidden size={20} stroke={2} />
            ) : (
                <IconPlus aria-hidden size={20} stroke={2} />
            )
        const className = clsx(
            classes.btn,
            variant === 'primary' && clsx(classes.btnPrimary, classes.btnGlow),
            variant === 'secondary' && classes.btnSecondary,
            variant === 'ghost' && classes.btnGhost
        )

        if (button.type === 'copyButton') {
            const isCopied = clipboard.copied && copiedButton === button
            return (
                <button
                    className={className}
                    onClick={() => {
                        clipboard.copy(format(button))
                        setCopiedButton(button)
                        vibrate('tap')
                    }}
                    type="button"
                >
                    {isCopied ? <IconCheck aria-hidden size={20} stroke={2} /> : icon}
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
        <article aria-labelledby={titleId} className={clsx(classes.card, classes.appCard)}>
            <div className={classes.appCardHead}>
                <AppIcon app={app} size="sm" />
                <h3 className={classes.appCardTitle} id={titleId}>
                    {t('setupApp', { name: app.name })}
                </h3>
            </div>

            {(install || add) && (
                <div className={classes.btnRow}>
                    {install && renderButton(install, 'secondary', t('install'))}
                    {add &&
                        renderButton(
                            add,
                            'primary',
                            add.type === 'subscriptionLink' ? t('addSubscription') : undefined
                        )}
                </div>
            )}

            <ol aria-label={t('howTo')} className={classes.steps}>
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
        </article>
    )
}
