import { useClipboard } from '@mantine/hooks'
import {
    TSubscriptionPageAppConfig,
    TSubscriptionPageButtonConfig,
    TSubscriptionPageLanguageCode,
    TSubscriptionPageLocalizedText,
    TSubscriptionPagePlatformKey
} from '@remnawave/subscription-page-types'
import { IconCheck, IconDownload, IconPlus } from '@tabler/icons-react'
import clsx from 'clsx'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { TemplateEngine } from '@shared/utils/template-engine'
import { vibrate } from '@shared/utils/vibrate'

import { useAppConfig } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { PLATFORM_ORDER } from '../format'
import { useSpofyT } from '../i18n'
import classes from '../spofy.module.css'

type TButton = TSubscriptionPageButtonConfig

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

/** Arrow-key navigation for a radiogroup of buttons (roving tabindex). */
function rovingKeys<T extends string | number>(
    items: T[],
    current: T,
    select: (item: T) => void,
    refs: React.RefObject<Map<T, HTMLButtonElement | null>>
) {
    return (event: React.KeyboardEvent) => {
        const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
        if (!delta) return
        event.preventDefault()
        const next = items[(items.indexOf(current) + delta + items.length) % items.length]!
        select(next)
        refs.current?.get(next)?.focus()
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

    const [platform, setPlatform] = useState<TSubscriptionPagePlatformKey | undefined>(() =>
        detected && available.includes(detected) ? detected : available[0]
    )
    const [picked, setPicked] = useState<{ index: number; platform: string } | null>(null)
    const platformRefs = useRef(new Map<TSubscriptionPagePlatformKey, HTMLButtonElement | null>())
    const appRefs = useRef(new Map<number, HTMLButtonElement | null>())

    // keep the preselected platform visible in the horizontally scrolling track (phones)
    useEffect(() => {
        const chip = platform ? platformRefs.current.get(platform) : null
        const row = chip?.parentElement
        if (!chip || !row || row.scrollWidth <= row.clientWidth) return
        row.scrollLeft = chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2
    }, [platform])

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
    const appIndexes = apps.map((_, index) => index)

    const selectPlatform = (key: TSubscriptionPagePlatformKey) => {
        vibrate('selection')
        setPlatform(key)
    }
    const selectApp = (index: number) => {
        vibrate('selection')
        setPicked({ platform: platform!, index })
    }
    const onPlatformKeys = rovingKeys(available, platform!, selectPlatform, platformRefs)
    const onAppKeys = rovingKeys(appIndexes, appIndex, selectApp, appRefs)

    if (!platform || available.length === 0 || apps.length === 0) return null
    const app = apps[appIndex]!

    return (
        <section aria-labelledby={headingId} className={classes.section}>
            <div className={classes.sectionHead}>
                <h2 className={classes.sectionTitle} id={headingId}>
                    {t('connectTitle')}
                </h2>
                {available.length > 1 && <p className={classes.sectionHint}>{t('connectHint')}</p>}
            </div>

            {available.length > 1 && (
                <div
                    aria-label={t('platform')}
                    className={classes.track}
                    onKeyDown={onPlatformKeys}
                    role="radiogroup"
                >
                    {available.map((key) => {
                        const platformConfig = config.platforms[key]!
                        const checked = key === platform
                        return (
                            <button
                                aria-checked={checked}
                                className={classes.segment}
                                key={key}
                                onClick={() => selectPlatform(key)}
                                ref={(el) => {
                                    platformRefs.current.set(key, el)
                                }}
                                role="radio"
                                tabIndex={checked ? 0 : -1}
                                type="button"
                            >
                                <SvgIcon
                                    className={classes.segmentIcon}
                                    svg={config.svgLibrary[platformConfig.svgIconKey]}
                                />
                                {localized(platformConfig.displayName, lang)}
                            </button>
                        )
                    })}
                </div>
            )}

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
                            <SvgIcon
                                className={classes.appIcon}
                                svg={
                                    item.svgIconKey ? config.svgLibrary[item.svgIconKey] : undefined
                                }
                            />
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
            variant === 'primary' && classes.btnPrimary,
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
            <h3 className={classes.appCardTitle} id={titleId} tabIndex={-1}>
                {t('setupApp', { name: app.name })}
            </h3>

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
                    return (
                        <li className={classes.step} key={index}>
                            <span aria-hidden className={clsx(classes.stepNum, classes.num)}>
                                {index + 1}
                            </span>
                            <div className={classes.stepBody}>
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
