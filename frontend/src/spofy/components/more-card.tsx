import {
    IconBrandTelegram,
    IconCheck,
    IconChevronRight,
    IconCopy,
    IconExternalLink,
    IconMessageCircle,
    IconQrcode,
    IconUserCircle
} from '@tabler/icons-react'
import clsx from 'clsx'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { vibrate } from '@shared/utils/vibrate'
import { whenIdle } from '@shared/utils/when-idle'

import { useAppConfig } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { useCopy } from '../copy'
import { useSpofyT } from '../i18n'
import { useQrStore } from '../qr-store'
import classes from '../spofy.module.css'
import { isTelegramLink } from './header'
import { ManualCopy } from './manual-copy'

// Its Mantine code is fetched while the page is idle, so tapping «QR» still opens it at once.
const loadQrModal = () => import('./qr-modal')
const QrModal = lazy(loadQrModal)

const hostOf = (url: string) => {
    try {
        return new URL(url).host
    } catch {
        return url
    }
}

/**
 * Everything besides the guide, as plain labelled rows: another device (QR), the link itself and
 * the web cabinet. Each row says what it does; nothing is an unlabelled icon.
 */
export function MoreCard({
    cabinetUrl,
    guideHasCopy = false
}: {
    cabinetUrl: null | string
    /** the open guide already has «Скопировать ссылку» with the same warning: not twice */
    guideHasCopy?: boolean
}) {
    const config = useAppConfig()
    const subscription = useSubscription()
    const { t } = useSpofyT()
    const qrOpen = useQrStore((state) => state.open)
    const setQrOpen = useQrStore((state) => state.setOpen)

    const subscriptionUrl = useMemo(
        () => constructSubscriptionUrl(window.location.href, subscription.user.shortUuid),
        [subscription.user.shortUuid]
    )
    const showLink = !config.baseSettings.hideGetLinkButton
    const { copied, copy, failed } = useCopy()

    // Also opened from the TV hint in the guide, so it stays mounted even with no rows.
    const [qrReady, setQrReady] = useState(false)
    useEffect(() => {
        whenIdle(() => {
            loadQrModal()
                .then(() => setQrReady(true))
                .catch(() => undefined)
        })
    }, [])
    const qrModal = (qrReady || qrOpen) && (
        <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
                <QrModal subscriptionUrl={subscriptionUrl} />
            </Suspense>
        </ErrorBoundary>
    )

    return (
        <section aria-label={t('subscriptionLink')} className={clsx(classes.card, classes.more)}>
            <ul className={classes.list}>
                {/* the link itself, always (owner 23.10.2026) — here, or in the open guide */}
                {!guideHasCopy && (
                    <li>
                        <button
                            className={classes.listRow}
                            onClick={() => {
                                vibrate('tap')
                                void copy(subscriptionUrl, 'more')
                            }}
                            type="button"
                        >
                            <span aria-hidden className={classes.listIcon} data-hue="indigo">
                                {copied === 'more' ? (
                                    <IconCheck size={20} stroke={2.2} />
                                ) : (
                                    <IconCopy size={20} stroke={1.9} />
                                )}
                            </span>
                            <span className={classes.listText}>
                                <span aria-live="polite" className={classes.listTitle}>
                                    {copied === 'more' ? t('copied') : t('copyLinkFull')}
                                </span>
                                <span className={classes.listCaption}>{t('moreCopyHint')}</span>
                            </span>
                        </button>
                        {failed === 'more' && <ManualCopy text={subscriptionUrl} />}
                    </li>
                )}
                {showLink && (
                    <li>
                        <button
                            className={classes.listRow}
                            onClick={() => {
                                vibrate('tap')
                                setQrOpen(true)
                            }}
                            type="button"
                        >
                            <span aria-hidden className={classes.listIcon} data-hue="sky">
                                <IconQrcode size={20} stroke={1.9} />
                            </span>
                            <span className={classes.listText}>
                                <span className={classes.listTitle}>{t('moreQr')}</span>
                                <span className={classes.listCaption}>{t('moreQrHint')}</span>
                            </span>
                            <IconChevronRight
                                aria-hidden
                                className={classes.listTrail}
                                size={18}
                                stroke={2}
                            />
                        </button>
                    </li>
                )}
                {cabinetUrl && (
                    <li>
                        <a
                            className={classes.listRow}
                            href={cabinetUrl}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            <span aria-hidden className={classes.listIcon} data-hue="slate">
                                <IconUserCircle size={20} stroke={1.9} />
                            </span>
                            <span className={classes.listText}>
                                <span className={classes.listTitle}>{t('moreCabinet')}</span>
                                <span className={classes.listCaption}>{hostOf(cabinetUrl)}</span>
                            </span>
                            <IconExternalLink
                                aria-hidden
                                className={classes.listTrail}
                                size={17}
                                stroke={2}
                            />
                        </a>
                    </li>
                )}
            </ul>
            {qrModal}
        </section>
    )
}

/** The only support entry on the page: one labelled button at the very bottom. */
export function SupportButton({ supportUrl }: { supportUrl: null | string }) {
    const { t } = useSpofyT()
    if (!supportUrl) return null
    const telegram = isTelegramLink(supportUrl)
    return (
        <a
            className={clsx(classes.btn, classes.btnSecondary, classes.supportBtn)}
            href={supportUrl}
            rel="noopener noreferrer"
            target="_blank"
        >
            {/* the same icon tile as the rows above: one visual language on the page */}
            <span
                aria-hidden
                className={classes.listIcon}
                data-hue={telegram ? 'telegram' : 'sky'}
            >
                {telegram ? (
                    <IconBrandTelegram size={20} stroke={1.9} />
                ) : (
                    <IconMessageCircle size={20} stroke={1.9} />
                )}
            </span>
            <span className={classes.supportText}>
                <span>{t('writeSupport')}</span>
                <span className={classes.supportCaption}>
                    {telegram ? t('moreSupportTg') : t('moreSupportOther')}
                </span>
            </span>
        </a>
    )
}
