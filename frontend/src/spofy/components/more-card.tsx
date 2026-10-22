import { Modal } from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
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
import { useMemo } from 'react'

import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { vibrate } from '@shared/utils/vibrate'

import { useAppConfig } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { useSpofyT } from '../i18n'
import { useQrDataUrl } from '../qr'
import { useQrStore } from '../qr-store'
import classes from '../spofy.module.css'
import { isTelegramLink } from './header'

const hostOf = (url: string) => {
    try {
        return new URL(url).host
    } catch {
        return url
    }
}

/**
 * Everything besides the guide, as plain labelled rows: another device (QR), the link itself,
 * the web cabinet and support. Each row says what it does; nothing is an unlabelled icon.
 */
export function MoreCard({
    cabinetUrl,
    supportUrl
}: {
    cabinetUrl: null | string
    supportUrl: null | string
}) {
    const config = useAppConfig()
    const subscription = useSubscription()
    const { t } = useSpofyT()
    const clipboard = useClipboard({ timeout: 2_000 })
    const qrOpen = useQrStore((state) => state.open)
    const setQrOpen = useQrStore((state) => state.setOpen)

    const subscriptionUrl = useMemo(
        () => constructSubscriptionUrl(window.location.href, subscription.user.shortUuid),
        [subscription.user.shortUuid]
    )
    const qrSrc = useQrDataUrl(qrOpen ? subscriptionUrl : null)
    const showLink = !config.baseSettings.hideGetLinkButton
    const telegram = isTelegramLink(supportUrl)

    // Also opened from the TV hint in the guide, so it stays mounted even with no rows.
    const qrModal = (
        <Modal
            centered
            classNames={{
                content: classes.modalContent,
                header: classes.modalHeader,
                title: classes.modalTitle,
                close: classes.modalClose
            }}
            closeButtonProps={{ 'aria-label': t('close') }}
            onClose={() => setQrOpen(false)}
            opened={qrOpen}
            radius="lg"
            title={t('qrTitle')}
            transitionProps={{ duration: 150 }}
        >
            <div className={classes.qrFrame}>
                {qrOpen && qrSrc && <img alt={t('qrTitle')} className={classes.qr} src={qrSrc} />}
            </div>
            <p className={classes.qrText}>{t('qrText')}</p>
        </Modal>
    )

    if (!showLink && !cabinetUrl && !supportUrl) return qrModal

    return (
        <section aria-label={t('subscriptionLink')} className={clsx(classes.card, classes.more)}>
            <ul className={classes.list}>
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
                            <span aria-hidden className={classes.listIcon} data-hue="blue">
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
                {showLink && (
                    <li>
                        <button
                            className={classes.listRow}
                            onClick={() => {
                                clipboard.copy(subscriptionUrl)
                                vibrate('tap')
                            }}
                            type="button"
                        >
                            <span
                                aria-hidden
                                className={classes.listIcon}
                                data-hue={clipboard.copied ? 'green' : 'violet'}
                            >
                                {clipboard.copied ? (
                                    <IconCheck size={20} stroke={2.4} />
                                ) : (
                                    <IconCopy size={20} stroke={1.9} />
                                )}
                            </span>
                            <span className={classes.listText}>
                                <span aria-live="polite" className={classes.listTitle}>
                                    {clipboard.copied ? t('copied') : t('moreCopy')}
                                </span>
                                <span className={classes.listCaption}>{t('moreCopyHint')}</span>
                            </span>
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
                {supportUrl && (
                    <li>
                        <a
                            className={classes.listRow}
                            href={supportUrl}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            <span aria-hidden className={classes.listIcon} data-hue="sky">
                                {telegram ? (
                                    <IconBrandTelegram size={20} stroke={1.9} />
                                ) : (
                                    <IconMessageCircle size={20} stroke={1.9} />
                                )}
                            </span>
                            <span className={classes.listText}>
                                <span className={classes.listTitle}>{t('moreSupport')}</span>
                                <span className={classes.listCaption}>
                                    {telegram ? t('moreSupportTg') : t('moreSupportOther')}
                                </span>
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
