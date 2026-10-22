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
    IconCopy,
    IconDownload,
    IconExternalLink,
    IconInfoCircle,
    IconPlus,
    IconQrcode
} from '@tabler/icons-react'
import clsx from 'clsx'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { vibrate } from '@shared/utils/vibrate'

import { useAppConfig } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { getAppLogo, isAllowedApp } from '../app-logos'
import { countOf, PLATFORM_ORDER } from '../format'
import { useSpofyT } from '../i18n'
import { formatLink, useLinkTemplates } from '../link-template'
import { prefs } from '../prefs'
import { useQrStore } from '../qr-store'
import classes from '../spofy.module.css'

type TButton = TSubscriptionPageButtonConfig

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

/** Steps already done for this platform + app, remembered on this device. */
function useDoneSteps(key: string) {
    // the guide is remounted for every platform + app (keyed), so the key never changes here
    const [done, setDone] = useState<number[]>(() => prefs.steps(key))
    const mark = (index: number) =>
        setDone((current) => {
            if (current.includes(index)) return current
            const next = [...current, index]
            prefs.setSteps(key, next)
            return next
        })
    return { done, mark }
}

/**
 * «How to connect» — the main block of the page. Platform and app are chips (the detected
 * platform and the recommended app come preselected), and every step is open with its buttons
 * inside it, so a newcomer just goes down the list. Steps tick themselves off as they are used.
 */
export function ConnectSection({
    collapsed: startCollapsed,
    detected,
    supportUrl
}: {
    /** the subscription has ended: the guide waits behind one row */
    collapsed: boolean
    detected: TSubscriptionPagePlatformKey | undefined
    supportUrl: null | string
}) {
    const config = useAppConfig()
    const subscription = useSubscription()
    const { t, lang } = useSpofyT()
    const headingId = useId()
    const [collapsed, setCollapsed] = useState(startCollapsed)
    const stepsAnchor = useRef<HTMLDivElement>(null)
    const showSteps = () => {
        vibrate('selection')
        const top = stepsAnchor.current?.getBoundingClientRect().top
        // only move when the steps are out of sight or near the bottom edge
        if (top !== undefined && (top < 0 || top > window.innerHeight * 0.6)) {
            stepsAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    const appsOf = (key: TSubscriptionPagePlatformKey) =>
        (config.platforms[key]?.apps ?? []).filter((app) => isAllowedApp(app.name))
    const available = PLATFORM_ORDER.filter((key) => appsOf(key).length > 0)

    const [platform, setPlatform] = useState<TSubscriptionPagePlatformKey | undefined>(() => {
        const remembered = prefs.platform() as TSubscriptionPagePlatformKey | undefined
        if (remembered && available.includes(remembered)) return remembered
        return detected && available.includes(detected) ? detected : available[0]
    })
    const [picked, setPicked] = useState<{ name: string; platform: string } | null>(() =>
        platform ? { platform, name: prefs.app(platform) ?? '' } : null
    )

    const subscriptionUrl = useMemo(
        () => constructSubscriptionUrl(window.location.href, subscription.user.shortUuid),
        [subscription.user.shortUuid]
    )

    // featured (recommended) app first
    const apps = platform
        ? [...appsOf(platform)].sort((a, b) => Number(b.featured) - Number(a.featured))
        : []
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

    const selectPlatform = (key: TSubscriptionPagePlatformKey) => {
        vibrate('selection')
        setPlatform(key)
        prefs.setPlatform(key)
    }
    const selectApp = (index: number) => {
        vibrate('selection')
        setPicked({ platform, name: apps[index]!.name })
        prefs.setApp(platform, apps[index]!.name)
    }

    if (collapsed) {
        return (
            <section aria-labelledby={headingId} className={clsx(classes.card, classes.connect)}>
                <button
                    aria-expanded={false}
                    className={classes.collapsedRow}
                    onClick={() => setCollapsed(false)}
                    type="button"
                >
                    <span className={classes.collapsedText}>
                        <span className={classes.sectionTitle} id={headingId}>
                            {t('cnTitle')}
                        </span>
                        <span className={classes.sectionLead}>{t('cnLeadExpired')}</span>
                    </span>
                    <IconChevronDown
                        aria-hidden
                        className={classes.chevron}
                        size={20}
                        stroke={2.2}
                    />
                </button>
            </section>
        )
    }

    return (
        <section aria-labelledby={headingId} className={clsx(classes.card, classes.connect)}>
            <div className={classes.sectionHead}>
                <h2 className={classes.sectionTitle} id={headingId}>
                    {t('cnTitle')}
                </h2>
                <p className={classes.sectionLead}>{t('cnLead')}</p>
            </div>

            {available.length > 1 && (
                <ChipGroup
                    items={available.map((key) => {
                        const item = config.platforms[key]!
                        return {
                            key,
                            label: localized(item.displayName, lang),
                            icon: (
                                <SvgIcon
                                    className={classes.chipIcon}
                                    svg={config.svgLibrary[item.svgIconKey]}
                                />
                            )
                        }
                    })}
                    label={t('cnPlatforms')}
                    onReselect={showSteps}
                    onSelect={(key) => selectPlatform(key as TSubscriptionPagePlatformKey)}
                    value={platform}
                />
            )}

            {apps.length > 1 && (
                <ChipGroup
                    items={apps.map((item) => ({
                        key: item.name,
                        label: item.name,
                        icon: <AppIcon app={item} />,
                        tag: item.featured ? t('recommended') : undefined
                    }))}
                    label={t('cnApps')}
                    onReselect={showSteps}
                    onSelect={(name) => selectApp(apps.findIndex((item) => item.name === name))}
                    value={app.name}
                />
            )}

            <div aria-hidden className={classes.stepsAnchor} ref={stepsAnchor} />
            <Steps
                app={app}
                isTv={TV_PLATFORMS.includes(platform)}
                key={`${platform}-${app.name}`}
                platform={platform}
                subscriptionUrl={subscriptionUrl}
                username={subscription.user.username}
            />

            {supportUrl && (
                <p className={classes.helpLine}>
                    {t('cnHelp')}{' '}
                    <a href={supportUrl} rel="noopener noreferrer" target="_blank">
                        {t('writeSupport')}
                    </a>
                </p>
            )}
        </section>
    )
}

/** A row of choice chips (radio group). Scrolls sideways when it does not fit. */
function ChipGroup(props: {
    items: { icon: React.ReactNode; key: string; label: string; tag?: string }[]
    label: string
    /** the already chosen chip was tapped again */
    onReselect?: () => void
    onSelect: (key: string) => void
    value: string
}) {
    const { items, label, onReselect, onSelect, value } = props
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
    // keep the selected chip in view when the row scrolls sideways (never scroll the page)
    useEffect(() => {
        const chip = refs.current.get(value)
        const row = chip?.parentElement
        if (!chip || !row || row.scrollWidth <= row.clientWidth) return
        const left = chip.offsetLeft - row.offsetLeft
        if (left < row.scrollLeft || left + chip.offsetWidth > row.scrollLeft + row.clientWidth) {
            row.scrollLeft = Math.max(0, left - 16)
        }
    }, [value])

    return (
        <div aria-label={label} className={classes.chips} onKeyDown={onKeys} role="radiogroup">
            {items.map((item) => {
                const checked = item.key === value
                return (
                    <button
                        aria-checked={checked}
                        className={classes.chip}
                        key={item.key}
                        onClick={() => (checked ? onReselect?.() : onSelect(item.key))}
                        ref={(el) => {
                            refs.current.set(item.key, el)
                        }}
                        role="radio"
                        tabIndex={checked ? 0 : -1}
                        type="button"
                    >
                        {item.icon}
                        <span className={classes.chipLabel}>{item.label}</span>
                        {item.tag && <span className={classes.chipTag}>{item.tag}</span>}
                    </button>
                )
            })}
        </div>
    )
}

function Steps(props: {
    app: TSubscriptionPageAppConfig
    isTv: boolean
    platform: string
    subscriptionUrl: string
    username: string
}) {
    const { app, isTv, platform, subscriptionUrl, username } = props
    const { svgLibrary } = useAppConfig()
    const { t, lang } = useSpofyT()
    const clipboard = useClipboard({ timeout: 2_000 })
    const openQr = useQrStore((state) => state.setOpen)
    const [copiedButton, setCopiedButton] = useState<TButton | null>(null)
    const { done, mark } = useDoneSteps(`${platform}:${app.name}`)
    // «The app did not open?» — shown under a step when its deep link left the page in front.
    const [notOpened, setNotOpened] = useState<null | number>(null)
    const timer = useRef<number | undefined>(undefined)
    useEffect(() => () => window.clearTimeout(timer.current), [])

    useLinkTemplates(app.blocks.flatMap((block) => block.buttons.map((button) => button.link)))
    /** null while the crypto library is still loading for a link that needs it */
    const formatOrNull = (button: TButton) =>
        button.type === 'external'
            ? button.link
            : formatLink(button.link, { username, subscriptionUrl })

    const current = app.blocks.findIndex((_, index) => !done.includes(index))
    const total = app.blocks.length

    const watchDeepLink = (index: number) => {
        window.clearTimeout(timer.current)
        setNotOpened(null)
        let left = false
        const away = () => {
            left = true
        }
        document.addEventListener('visibilitychange', away, { once: true })
        window.addEventListener('blur', away, { once: true })
        timer.current = window.setTimeout(() => {
            document.removeEventListener('visibilitychange', away)
            window.removeEventListener('blur', away)
            if (!left && document.visibilityState === 'visible') setNotOpened(index)
        }, 1_600)
    }

    const copyLink = (button: TButton | null) => {
        const link = button ? formatOrNull(button) : subscriptionUrl
        if (link === null) return // never copy a placeholder
        clipboard.copy(link)
        setCopiedButton(button)
        vibrate('tap')
    }

    const renderButton = (button: TButton, index: number, key: number) => {
        const text = localized(button.text, lang)
        if (button.type === 'copyButton') {
            const isCopied = clipboard.copied && copiedButton === button
            return (
                <button
                    className={clsx(classes.btn, classes.btnSecondary, classes.btnSmall)}
                    key={key}
                    onClick={() => {
                        copyLink(button)
                        mark(index)
                    }}
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

        if (button.type === 'subscriptionLink') {
            const href = formatOrNull(button) ?? '#'
            return (
                <a
                    className={clsx(
                        classes.btn,
                        classes.btnPrimary,
                        classes.btnGlow,
                        classes.btnWide
                    )}
                    href={href}
                    key={key}
                    onClick={() => {
                        vibrate('tap')
                        mark(index)
                        watchDeepLink(index)
                    }}
                    title={text}
                >
                    <IconPlus aria-hidden size={19} stroke={2.3} />
                    {t('cnAddTo', { name: app.name })}
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
                                <p
                                    className={classes.stepText}
                                    dangerouslySetInnerHTML={{
                                        __html: localized(block.description, lang)
                                    }}
                                />
                                {buttons.length > 0 && (
                                    <div className={classes.stepButtons}>
                                        {buttons.map((button, i) => renderButton(button, index, i))}
                                    </div>
                                )}
                                {notOpened === index && (
                                    <div className={classes.notOpened} role="status">
                                        <IconInfoCircle aria-hidden size={19} stroke={2} />
                                        <div>
                                            <strong>{t('cnNotOpened')}</strong>
                                            <p>{t('cnNotOpenedText')}</p>
                                            {!buttons.some((b) => b.type === 'copyButton') && (
                                                <button
                                                    className={clsx(
                                                        classes.btn,
                                                        classes.btnSecondary,
                                                        classes.btnSmall
                                                    )}
                                                    onClick={() => copyLink(null)}
                                                    type="button"
                                                >
                                                    {clipboard.copied && copiedButton === null ? (
                                                        <IconCheck
                                                            aria-hidden
                                                            size={18}
                                                            stroke={2.4}
                                                        />
                                                    ) : (
                                                        <IconCopy
                                                            aria-hidden
                                                            size={18}
                                                            stroke={2}
                                                        />
                                                    )}
                                                    {clipboard.copied && copiedButton === null
                                                        ? t('copied')
                                                        : t('copyLinkFull')}
                                                </button>
                                            )}
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
