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

export function ConnectSection({
    detected
}: {
    detected: TSubscriptionPagePlatformKey | undefined
}) {
    const config = useAppConfig()
    const subscription = useSubscription()
    const { t, lang } = useSpofyT()
    const headingId = useId()
    const othersId = useId()

    const available = PLATFORM_ORDER.filter((key) => (config.platforms[key]?.apps.length ?? 0) > 0)

    const [platform, setPlatform] = useState<TSubscriptionPagePlatformKey | undefined>(() =>
        detected && available.includes(detected) ? detected : available[0]
    )
    const [picked, setPicked] = useState<{ index: number; platform: string } | null>(null)
    const [othersOpen, setOthersOpen] = useState(false)
    const platformRefs = useRef<Record<string, HTMLButtonElement | null>>({})
    const appTitleRef = useRef<HTMLHeadingElement>(null)

    // keep the preselected platform visible in the horizontally scrolling row (phones)
    useEffect(() => {
        const chip = platform ? platformRefs.current[platform] : null
        const row = chip?.parentElement
        if (!chip || !row || row.scrollWidth <= row.clientWidth) return
        row.scrollLeft = chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2
    }, [platform])

    const subscriptionUrl = useMemo(
        () => constructSubscriptionUrl(window.location.href, subscription.user.shortUuid),
        [subscription.user.shortUuid]
    )

    if (!platform || available.length === 0) return null

    const apps = config.platforms[platform]!.apps
    const featuredIndex = Math.max(
        0,
        apps.findIndex((app) => app.featured)
    )
    const appIndex =
        picked?.platform === platform && apps[picked.index] ? picked.index : featuredIndex
    const app = apps[appIndex]!
    const others = apps.map((item, index) => ({ item, index })).filter((x) => x.index !== appIndex)

    const selectPlatform = (key: TSubscriptionPagePlatformKey, focus = false) => {
        vibrate('selection')
        setPlatform(key)
        setOthersOpen(false)
        if (focus) platformRefs.current[key]?.focus()
    }

    const onPlatformKeyDown = (event: React.KeyboardEvent) => {
        const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
        if (!delta) return
        event.preventDefault()
        const current = available.indexOf(platform)
        const next = available[(current + delta + available.length) % available.length]!
        selectPlatform(next, true)
    }

    return (
        <section aria-labelledby={headingId} className={classes.card}>
            <div className={classes.connectHead}>
                <h2 className={classes.sectionTitle} id={headingId}>
                    {t('connectTitle')}
                </h2>

                {available.length > 1 && (
                    <div
                        aria-label={t('platform')}
                        className={classes.platforms}
                        onKeyDown={onPlatformKeyDown}
                        role="radiogroup"
                    >
                        {available.map((key) => {
                            const platformConfig = config.platforms[key]!
                            const checked = key === platform
                            return (
                                <button
                                    aria-checked={checked}
                                    className={classes.platform}
                                    key={key}
                                    onClick={() => selectPlatform(key)}
                                    ref={(el) => {
                                        platformRefs.current[key] = el
                                    }}
                                    role="radio"
                                    tabIndex={checked ? 0 : -1}
                                    type="button"
                                >
                                    <SvgIcon
                                        className={classes.platformIcon}
                                        svg={config.svgLibrary[platformConfig.svgIconKey]}
                                    />
                                    {localized(platformConfig.displayName, lang)}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            <AppCard
                app={app}
                isFeatured={appIndex === featuredIndex && !!apps[featuredIndex]?.featured}
                key={`${platform}-${appIndex}`}
                subscriptionUrl={subscriptionUrl}
                titleRef={appTitleRef}
                username={subscription.user.username}
            />

            {others.length > 0 && (
                <>
                    <button
                        aria-controls={othersId}
                        aria-expanded={othersOpen}
                        className={classes.disclosure}
                        onClick={() => setOthersOpen((open) => !open)}
                        type="button"
                    >
                        <span>
                            {t('otherApps')}{' '}
                            <span className={clsx(classes.muted, classes.num)}>
                                {others.length}
                            </span>
                        </span>
                        <IconChevronDown
                            aria-hidden
                            className={clsx(classes.chevron, othersOpen && classes.chevronOpen)}
                            size={20}
                        />
                    </button>
                    <ul className={classes.otherList} hidden={!othersOpen} id={othersId}>
                        {others.map(({ item, index }) => (
                            <li key={item.name}>
                                <button
                                    aria-label={t('useThisApp', { name: item.name })}
                                    className={classes.otherApp}
                                    onClick={() => {
                                        vibrate('selection')
                                        setPicked({ platform, index })
                                        setOthersOpen(false)
                                        requestAnimationFrame(() => appTitleRef.current?.focus())
                                    }}
                                    type="button"
                                >
                                    <SvgIcon
                                        className={classes.appIcon}
                                        svg={
                                            item.svgIconKey
                                                ? config.svgLibrary[item.svgIconKey]
                                                : undefined
                                        }
                                    />
                                    <span className={classes.otherAppName}>{item.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </section>
    )
}

function AppCard(props: {
    app: TSubscriptionPageAppConfig
    isFeatured: boolean
    subscriptionUrl: string
    titleRef: React.RefObject<HTMLHeadingElement | null>
    username: string
}) {
    const { app, isFeatured, subscriptionUrl, titleRef, username } = props
    const { svgLibrary } = useAppConfig()
    const { t, lang } = useSpofyT()
    const clipboard = useClipboard({ timeout: 2_000 })
    const [copiedButton, setCopiedButton] = useState<TButton | null>(null)

    const { install, add } = pickHeroButtons(app)

    const format = (button: TButton) =>
        button.type === 'external'
            ? button.link
            : TemplateEngine.formatWithMetaInfo(button.link, { username, subscriptionUrl })

    const copy = (button: TButton) => {
        clipboard.copy(format(button))
        setCopiedButton(button)
        vibrate('tap')
    }

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
                <button className={className} onClick={() => copy(button)} type="button">
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
        <article className={classes.app}>
            <div className={classes.appHead}>
                <SvgIcon
                    className={classes.appIcon}
                    svg={app.svgIconKey ? svgLibrary[app.svgIconKey] : undefined}
                />
                <div>
                    <h3 className={classes.appName} ref={titleRef} tabIndex={-1}>
                        {app.name}
                    </h3>
                    {isFeatured && <span className={classes.badge}>{t('recommended')}</span>}
                </div>
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
                    return (
                        <li className={classes.step} key={index}>
                            <span aria-hidden className={clsx(classes.stepNum, classes.num)}>
                                {index + 1}
                            </span>
                            <div>
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
