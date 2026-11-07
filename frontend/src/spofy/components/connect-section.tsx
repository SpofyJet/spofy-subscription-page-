import {
    TSubscriptionPageAppConfig,
    TSubscriptionPageButtonConfig,
    TSubscriptionPageLanguageCode,
    TSubscriptionPageLocalizedText,
    TSubscriptionPagePlatformKey
} from '@remnawave/subscription-page-types'
import {
    IconBrandAndroid,
    IconBrandApple,
    IconBrandUbuntu,
    IconBrandWindows,
    IconCheck,
    IconChevronDown,
    IconDeviceLaptop,
    IconDeviceTv,
    IconDeviceTvOld,
    IconCopy,
    IconDownload,
    IconExternalLink,
    IconInfoCircle,
    IconPlugConnected,
    IconPlus,
    IconQrcode
} from '@tabler/icons-react'
import clsx from 'clsx'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { vibrate } from '@shared/utils/vibrate'

import { useAppConfig } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { getAppLogo, isAllowedApp, isDefaultApp } from '../app-logos'
import { useCopy } from '../copy'
import { countOf, PLATFORM_ORDER } from '../format'
import { useSpofyT } from '../i18n'
import { formatLink, useLinkTemplates } from '../link-template'
import { CONNECT_ID, CONNECT_OPEN_EVENT } from '../page-model'
import { prefs } from '../prefs'
import { useQrStore } from '../qr-store'
import { revealBlock, revealUnfolded } from '../scroll'
import classes from '../spofy.module.css'
import { ManualCopy } from './manual-copy'

type TButton = TSubscriptionPageButtonConfig

const TV_PLATFORMS: TSubscriptionPagePlatformKey[] = ['androidTV', 'appleTV']

function localized(
    text: TSubscriptionPageLocalizedText | undefined,
    lang: TSubscriptionPageLanguageCode
): string {
    if (!text) return ''
    return text[lang] ?? text.en ?? text.ru ?? Object.values(text)[0] ?? ''
}

/**
 * One icon set for the system tiles. The panel's glyphs drew macOS and Android TV as the same
 * monitor; a platform not listed here keeps the panel's glyph.
 */
const PLATFORM_ICONS: Partial<Record<string, typeof IconBrandApple>> = {
    ios: IconBrandApple,
    android: IconBrandAndroid,
    windows: IconBrandWindows,
    macos: IconDeviceLaptop,
    linux: IconBrandUbuntu,
    androidTV: IconDeviceTv,
    appleTV: IconDeviceTvOld
}

function PlatformIcon({ platform, svg }: { platform: string; svg: string | undefined }) {
    const Icon = PLATFORM_ICONS[platform]
    if (!Icon) return <SvgIcon className={classes.chipIcon} svg={svg} />
    return (
        <span aria-hidden className={classes.chipIcon}>
            <Icon size={22} stroke={1.8} />
        </span>
    )
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

/** Steps already done for this platform + app, remembered on this device. */
function useDoneSteps(key: string) {
    const [state, setState] = useState(() => ({ key, done: prefs.steps(key) }))
    const done = state.key === key ? state.done : prefs.steps(key)
    const mark = (index: number) =>
        setState((current) => {
            const base = current.key === key ? current.done : prefs.steps(key)
            if (base.includes(index)) return { key, done: base }
            const next = [...base, index]
            prefs.setSteps(key, next)
            return { key, done: next }
        })
    return { done, mark }
}

/**
 * «How to connect» — one card that folds both ways. Its head always says what it will take
 * («iPhone · 3 шага · пара минут») or how far the person got («шаг 2 из 3»), so even folded it
 * sells the next step. Open: the detected device in one line (the full list only behind
 * «Другое»), the app, then the steps with their buttons; steps tick themselves off as they are
 * used. Any «Подключить» button on the page opens it at the current step.
 */
export function ConnectSection({
    collapsed: startCollapsed,
    detected
}: {
    /** the guide waits behind one row: the subscription has ended, a device is already connected,
     *  or every device slot is taken */
    collapsed: 'connected' | 'ended' | 'full' | null
    detected: TSubscriptionPagePlatformKey | undefined
}) {
    const config = useAppConfig()
    const subscription = useSubscription()
    const { t, lang } = useSpofyT()
    const headingId = useId()
    const bodyId = useId()
    const [open, setOpen] = useState(startCollapsed === null)
    const [picking, setPicking] = useState(false)
    const sectionRef = useRef<HTMLElement>(null)
    const stepsAnchor = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const onOpen = () => {
            setOpen(true)
            // after the steps are drawn: go to the step to do now, or to the card itself
            window.requestAnimationFrame(() => {
                const section = sectionRef.current
                revealBlock(
                    section?.querySelector<HTMLElement>('[data-state="current"]') ?? section ?? null
                )
            })
        }
        window.addEventListener(CONNECT_OPEN_EVENT, onOpen)
        return () => window.removeEventListener(CONNECT_OPEN_EVENT, onOpen)
    }, [])
    // the chosen tile tapped again: go to the steps (and flash them, so the tap is answered)
    const showSteps = () => {
        vibrate('selection')
        revealBlock(stepsAnchor.current?.parentElement?.querySelector('ol') ?? null)
    }

    // Only Happ and INCY (owner's decision); if the panel names them some other way, the guide
    // falls back to the panel's own apps rather than disappearing (and «Подключить устройство»
    // would have nothing to lead to).
    const anyAllowed = PLATFORM_ORDER.some((key) =>
        (config.platforms[key]?.apps ?? []).some((app) => isAllowedApp(app.name))
    )
    const appsOf = (key: TSubscriptionPagePlatformKey) =>
        (config.platforms[key]?.apps ?? []).filter((app) => !anyAllowed || isAllowedApp(app.name))
    const available = PLATFORM_ORDER.filter((key) => appsOf(key).length > 0)

    // Always detect again on page load. A manual platform choice lasts only for this view;
    // if the UA is unknown, use the first available guide instead of an old stored platform.
    const [platform, setPlatform] = useState<TSubscriptionPagePlatformKey | undefined>(() =>
        detected && available.includes(detected) ? detected : available[0]
    )
    const [picked, setPicked] = useState<{ name: string; platform: string } | null>(() =>
        platform ? { platform, name: prefs.app(platform) ?? '' } : null
    )

    const subscriptionUrl = useMemo(
        () => constructSubscriptionUrl(window.location.href, subscription.user.shortUuid),
        [subscription.user.shortUuid]
    )

    // INCY is the owner's default recommendation. On platforms where the panel does not offer
    // INCY, keep the panel's featured app (Happ in the current configuration) as the fallback.
    const platformApps = platform ? appsOf(platform) : []
    const recommendedApp =
        platformApps.find((app) => isDefaultApp(app.name)) ??
        platformApps.find((app) => app.featured) ??
        platformApps[0]
    const apps = [...platformApps].sort(
        (a, b) => Number(b.name === recommendedApp?.name) - Number(a.name === recommendedApp?.name)
    )
    const featuredIndex = 0
    const pickedIndex =
        picked && picked.platform === platform
            ? apps.findIndex((app) => app.name === picked.name)
            : -1
    const appIndex = pickedIndex >= 0 ? pickedIndex : featuredIndex
    const app = apps[appIndex]
    const { done, mark } = useDoneSteps(`${platform}:${app?.name ?? ''}`)

    if (!platform || available.length === 0 || !app) return null
    const platformName = localized(config.platforms[platform]?.displayName, lang)
    const total = app.blocks.length
    const current = app.blocks.findIndex((_, index) => !done.includes(index))
    // the device was not recognised: the list is shown right away instead of a guess
    const known = !!detected && available.includes(detected)

    const selectPlatform = (key: TSubscriptionPagePlatformKey) => {
        vibrate('selection')
        setPlatform(key)
        setPicking(false)
    }
    const toggle = () => {
        vibrate('selection')
        if (open) {
            setOpen(false)
            setPicking(false)
            // folding a long guide must not leave the person far below the page
            const section = sectionRef.current
            if (section && section.getBoundingClientRect().top < 0) {
                window.requestAnimationFrame(() => revealBlock(section, { flash: false }))
            }
        } else {
            setOpen(true)
            // a head low on the screen would unfold the guide below the fold, and the tap would
            // look dead: once it is drawn, scroll just enough for the steps to start showing
            const section = sectionRef.current
            window.requestAnimationFrame(() => revealUnfolded(section))
        }
    }
    const selectApp = (index: number) => {
        vibrate('selection')
        setPicked({ platform, name: apps[index]!.name })
        prefs.setApp(platform, apps[index]!.name)
    }

    const title = startCollapsed === 'connected' ? t('cnMoreTitle') : t('cnTitle')
    const lead =
        startCollapsed === 'ended'
            ? t('cnLeadExpired')
            : current === -1
              ? t('cnLeadDone', { platform: platformName })
              : done.length > 0
                ? t('cnLeadProgress', { platform: platformName, n: current + 1, total })
                : t('cnLeadSteps', { platform: platformName, steps: countOf(total, lang, 'step') })

    return (
        <section
            aria-labelledby={headingId}
            className={clsx(classes.card, classes.connect)}
            data-open={open || undefined}
            id={CONNECT_ID}
            ref={sectionRef}
        >
            <button
                aria-controls={bodyId}
                aria-expanded={open}
                className={classes.connectHead}
                onClick={toggle}
                type="button"
            >
                <span
                    aria-hidden
                    className={classes.connectHeadIcon}
                    data-done={current === -1 || undefined}
                >
                    {current === -1 ? (
                        <IconCheck size={22} stroke={2.4} />
                    ) : (
                        <IconPlugConnected size={22} stroke={1.9} />
                    )}
                </span>
                <span className={classes.collapsedText}>
                    <span className={classes.sectionTitle} id={headingId}>
                        {title}
                    </span>
                    <span className={clsx(classes.sectionLead, classes.num)}>{lead}</span>
                </span>
                <IconChevronDown
                    aria-hidden
                    className={clsx(classes.chevron, open && classes.chevronOpen)}
                    size={20}
                    stroke={2.2}
                />
            </button>

            {open && (
                <div className={classes.connectBody} id={bodyId}>
                    {available.length > 1 && known && !picking && (
                        <div className={classes.deviceLine}>
                            <PlatformIcon
                                platform={platform}
                                svg={config.svgLibrary[config.platforms[platform]!.svgIconKey]}
                            />
                            <span className={classes.deviceLineText}>
                                <span className={classes.deviceLineLabel}>{t('cnPlatforms')}</span>
                                <span className={classes.deviceLineName}>{platformName}</span>
                            </span>
                            <button
                                className={clsx(classes.btn, classes.btnQuiet)}
                                onClick={() => {
                                    vibrate('selection')
                                    setPicking(true)
                                }}
                                type="button"
                            >
                                {t('cnChange')}
                            </button>
                        </div>
                    )}

                    {available.length > 1 && (!known || picking) && (
                        <ChipGroup
                            items={available.map((key) => {
                                const item = config.platforms[key]!
                                return {
                                    key,
                                    label: localized(item.displayName, lang),
                                    icon: (
                                        <PlatformIcon
                                            platform={key}
                                            svg={config.svgLibrary[item.svgIconKey]}
                                        />
                                    )
                                }
                            })}
                            label={t('cnPlatforms')}
                            onReselect={showSteps}
                            onSelect={(key) => selectPlatform(key as TSubscriptionPagePlatformKey)}
                            value={platform}
                            variant="tile"
                        />
                    )}

                    {apps.length > 1 && (
                        <ChipGroup
                            items={apps.map((item) => ({
                                key: item.name,
                                label: item.name,
                                icon: <AppIcon app={item} />,
                                tag: item.name === recommendedApp?.name ? t('recommended') : undefined
                            }))}
                            label={t('cnApps')}
                            onReselect={showSteps}
                            onSelect={(name) => selectApp(apps.findIndex((item) => item.name === name))}
                            value={app.name}
                            variant="app"
                        />
                    )}

                    <div aria-hidden className={classes.stepsAnchor} ref={stepsAnchor} />
                    <Steps
                        app={app}
                        done={done}
                        isTv={TV_PLATFORMS.includes(platform)}
                        key={`${platform}-${app.name}`}
                        mark={mark}
                        subscriptionUrl={subscriptionUrl}
                        username={subscription.user.username}
                    />

                    <button
                        aria-controls={bodyId}
                        aria-expanded
                        className={clsx(classes.btn, classes.btnQuiet, classes.connectFold)}
                        onClick={toggle}
                        type="button"
                    >
                        {t('cnCollapse')}
                        <IconChevronDown aria-hidden className={classes.chevronOpen} size={18} stroke={2.2} />
                    </button>
                </div>
            )}
        </section>
    )
}

/**
 * Choice tiles (radio group), all visible at once — no sideways scrolling: on a phone a swipe on
 * a scrolling row dragged the whole page into the empty space on the right.
 * Systems are tiles (icon above the name), apps are two halves (icon + name + «Рекомендуем»).
 */
function ChipGroup(props: {
    items: { icon: React.ReactNode; key: string; label: string; tag?: string }[]
    label: string
    /** the already chosen chip was tapped again */
    onReselect?: () => void
    onSelect: (key: string) => void
    value: string
    variant: 'app' | 'tile'
}) {
    const { items, label, onReselect, onSelect, value, variant } = props
    const refs = useRef(new Map<string, HTMLButtonElement | null>())
    const onKeys = (event: React.KeyboardEvent) => {
        const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
        if (!delta) return
        event.preventDefault()
        const index = items.findIndex((item) => item.key === value)
        const next = items[(index + delta + items.length) % items.length]!
        onSelect(next.key)
        refs.current.get(next.key)?.focus()
    }
    // 2 → 2 halves, 3 → one row, 4 → 2 × 2, 5–6 → rows of 3
    const n = items.length
    const cols = variant === 'app' ? Math.min(2, n) : n <= 3 ? n : n === 4 ? 2 : 3
    // rows of 3 with a short last row (5, 7 systems): the last tiles share the full width
    // instead of leaving a hole on the right — a 6-column grid, 2 columns per tile
    const rest = cols === 3 ? n % 3 : 0
    const spanOf = (index: number) => (rest && index >= n - rest ? 6 / rest : 2)

    return (
        <div
            aria-label={label}
            className={classes.chips}
            data-variant={variant}
            onKeyDown={onKeys}
            role="radiogroup"
            style={{ '--cols': rest ? 6 : cols } as React.CSSProperties}
        >
            {items.map((item, index) => {
                const checked = item.key === value
                return (
                    <button
                        aria-checked={checked}
                        className={clsx(
                            classes.chip,
                            variant === 'tile' ? classes.chipTile : classes.chipApp
                        )}
                        key={item.key}
                        onClick={() => (checked ? onReselect?.() : onSelect(item.key))}
                        ref={(el) => {
                            refs.current.set(item.key, el)
                        }}
                        role="radio"
                        style={rest ? { gridColumn: `span ${spanOf(index)}` } : undefined}
                        tabIndex={checked ? 0 : -1}
                        type="button"
                    >
                        {item.icon}
                        {variant === 'app' ? (
                            <span className={classes.chipAppText}>
                                <span className={classes.chipLabel}>{item.label}</span>
                                {item.tag && <span className={classes.chipTag}>{item.tag}</span>}
                            </span>
                        ) : (
                            <span className={classes.chipLabel}>{item.label}</span>
                        )}
                    </button>
                )
            })}
        </div>
    )
}

function Steps(props: {
    app: TSubscriptionPageAppConfig
    done: number[]
    isTv: boolean
    mark: (index: number) => void
    subscriptionUrl: string
    username: string
}) {
    const { app, done, isTv, mark, subscriptionUrl, username } = props
    const { svgLibrary } = useAppConfig()
    const { t, lang } = useSpofyT()
    const { copied, copy, failed } = useCopy()
    const openQr = useQrStore((state) => state.setOpen)
    // «The app did not open?» — shown under a step when its deep link left the page in front.
    const [notOpened, setNotOpened] = useState<null | number>(null)
    const timer = useRef<number | undefined>(undefined)
    const stopWatching = useRef<() => void>(() => {})
    useEffect(
        () => () => {
            window.clearTimeout(timer.current)
            stopWatching.current()
        },
        []
    )

    const linkStatus = useLinkTemplates(
        app.blocks.flatMap((block) => block.buttons.map((button) => button.link))
    )
    /** null while the crypto library is still loading for a link that needs it */
    const formatOrNull = (button: TButton) =>
        button.type === 'external'
            ? button.link
            : formatLink(button.link, { username, subscriptionUrl })

    const current = app.blocks.findIndex((_, index) => !done.includes(index))
    const total = app.blocks.length

    /** The step is ticked off only when the app really opened (the page went to background). */
    const watchDeepLink = (index: number) => {
        window.clearTimeout(timer.current)
        stopWatching.current()
        setNotOpened(null)
        let left = false
        const cleanup = () => {
            document.removeEventListener('visibilitychange', away)
            window.removeEventListener('blur', away)
        }
        stopWatching.current = cleanup
        const away = () => {
            if (left) return
            left = true
            window.clearTimeout(timer.current)
            cleanup()
            mark(index)
        }
        document.addEventListener('visibilitychange', away, { once: true })
        window.addEventListener('blur', away, { once: true })
        timer.current = window.setTimeout(() => {
            cleanup()
            if (!left && document.visibilityState === 'visible') {
                setNotOpened(index)
                // bring the hint into view — it appears below the button
                window.setTimeout(
                    () =>
                        document
                            .getElementById(`sp-not-opened-${index}`)
                            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
                    50
                )
            }
        }, 1_600)
    }

    /** Copy; the step is ticked off only if the link really landed in the clipboard. */
    const copyLink = async (button: TButton | null, index: number, key: string) => {
        const link = button ? formatOrNull(button) : subscriptionUrl
        if (link === null) return // never copy a placeholder
        vibrate('tap')
        if (await copy(link, key)) mark(index)
    }
    const copyButton = (index: number, key: string, button: TButton | null, text: string) => {
        const isCopied = copied === key
        const pending = button !== null && formatOrNull(button) === null
        return (
            <button
                className={clsx(classes.btn, classes.btnSecondary, classes.btnSmall)}
                disabled={pending}
                key={key}
                onClick={() => void copyLink(button, index, key)}
                type="button"
            >
                {isCopied ? (
                    <IconCheck aria-hidden size={18} stroke={2.4} />
                ) : (
                    <IconCopy aria-hidden size={18} stroke={2} />
                )}
                <span aria-live="polite">{isCopied ? t('copied') : text}</span>
            </button>
        )
    }

    const renderButton = (button: TButton, index: number, key: number) => {
        const text = localized(button.text, lang)
        if (button.type === 'copyButton') {
            return copyButton(index, `${index}:${key}`, button, text || t('copyLinkShort'))
        }

        if (button.type === 'subscriptionLink') {
            const href = formatOrNull(button)
            const content = (
                <>
                    <IconPlus aria-hidden size={19} stroke={2.3} />
                    {href === null
                        ? t(linkStatus === 'error' ? 'cnLinkError' : 'cnPreparingLink')
                        : t('cnAddTo', { name: app.name })}
                </>
            )
            const className = clsx(
                classes.btn,
                classes.btnPrimary,
                classes.btnWide
            )
            // Never turn an unprepared encrypted link into «#»: that both loses the page position
            // and starts a false «app did not open» timer. The plain copy action remains available.
            if (href === null) {
                return (
                    <button className={className} disabled key={key} title={text} type="button">
                        {content}
                    </button>
                )
            }
            return (
                <a
                    className={className}
                    href={href}
                    key={key}
                    onClick={() => {
                        vibrate('tap')
                        watchDeepLink(index)
                    }}
                    title={text}
                >
                    {content}
                </a>
            )
        }

        return (
            <a
                className={clsx(classes.btn, classes.btnSecondary, classes.btnSmall)}
                href={button.link}
                key={key}
                onClick={() => {
                    vibrate('tap')
                    mark(index)
                }}
                rel="noopener noreferrer"
                target="_blank"
            >
                {button.svgIconKey && svgLibrary[button.svgIconKey] ? (
                    <SvgIcon className={classes.btnIcon} svg={svgLibrary[button.svgIconKey]} />
                ) : (
                    <IconDownload aria-hidden size={18} stroke={2} />
                )}
                {text}
                <IconExternalLink aria-hidden className={classes.btnTrail} size={15} stroke={2} />
            </a>
        )
    }

    return (
        <>
            {isTv && (
                <button className={classes.tvHint} onClick={() => openQr(true)} type="button">
                    <span aria-hidden className={classes.iconSquare}>
                        <IconQrcode size={18} stroke={2} />
                    </span>
                    <span>{t('tvHint')}</span>
                </button>
            )}

            <ol
                aria-label={`${t('howTo')}: ${app.name}, ${countOf(total, lang, 'step')}`}
                className={classes.steps}
            >
                {app.blocks.map((block, index) => {
                    const isDone = done.includes(index)
                    const state = isDone ? 'done' : index === current ? 'current' : 'todo'
                    // subscription link first: it is the step's main action
                    const buttons = [...block.buttons].sort(
                        (a, b) =>
                            Number(b.type === 'subscriptionLink') -
                            Number(a.type === 'subscriptionLink')
                    )
                    const ownCopy =
                        buttons.some((b) => b.type === 'subscriptionLink') &&
                        !buttons.some((b) => b.type === 'copyButton')
                    return (
                        <li className={classes.step} data-state={state} key={index}>
                            <span aria-hidden className={clsx(classes.stepMarker, classes.num)}>
                                {isDone ? <IconCheck size={15} stroke={3} /> : index + 1}
                            </span>
                            <div className={classes.stepBody}>
                                <h3 className={classes.stepTitle}>
                                    <span
                                        dangerouslySetInnerHTML={{
                                            __html: localized(block.title, lang)
                                        }}
                                    />
                                    {isDone && (
                                        <span className={classes.visuallyHidden}>
                                            {' '}
                                            — {t('cnStepDone')}
                                        </span>
                                    )}
                                </h3>
                                {/* a finished step folds to its title; the rest stay explained */}
                                {state !== 'done' && (
                                    <p
                                        className={classes.stepText}
                                        dangerouslySetInnerHTML={{
                                            __html: localized(block.description, lang)
                                        }}
                                    />
                                )}
                                {buttons.length > 0 && (
                                    <div className={classes.stepButtons}>
                                        {buttons.map((button, i) => renderButton(button, index, i))}
                                        {/* the link can always be copied where it is added —
                                            whether or not the panel config has a copy button */}
                                        {ownCopy &&
                                            copyButton(
                                                index,
                                                `${index}:own`,
                                                null,
                                                t('copyLinkShort')
                                            )}
                                    </div>
                                )}
                                {failed?.startsWith(`${index}:`) && (
                                    <ManualCopy
                                        text={
                                            (failed.endsWith(':own')
                                                ? subscriptionUrl
                                                : formatOrNull(
                                                      buttons[Number(failed.split(':')[1])]!
                                                  )) ?? subscriptionUrl
                                        }
                                    />
                                )}
                                {(ownCopy || buttons.some((b) => b.type === 'copyButton')) &&
                                    !failed?.startsWith(`${index}:`) && (
                                        <p className={classes.stepNote}>{t('moreCopyHint')}</p>
                                    )}
                                {notOpened === index && (
                                    <div
                                        className={classes.notOpened}
                                        id={`sp-not-opened-${index}`}
                                        role="status"
                                    >
                                        <IconInfoCircle aria-hidden size={19} stroke={2} />
                                        <div>
                                            <strong>{t('cnNotOpened')}</strong>
                                            <p>{t('cnNotOpenedText')}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </li>
                    )
                })}
            </ol>
        </>
    )
}
