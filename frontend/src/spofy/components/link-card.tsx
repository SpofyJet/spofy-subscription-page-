import { Modal } from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import {
    IconCheck,
    IconCopy,
    IconExternalLink,
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

/** «…cw6JXrffn0»: only the part that tells one link from another (the host is the same for everyone). */
const shortLink = (url: string) => {
    try {
        const id = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? ''
        return id.length > 12 ? `…${id.slice(-12)}` : id || url
    } catch {
        return url.replace(/^https?:\/\//, '')
    }
}

const hostOf = (url: string) => {
    try {
        return new URL(url).host
    } catch {
        return url
    }
}

export function LinkCard({ cabinetUrl }: { cabinetUrl: null | string }) {
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

    const copy = () => {
        clipboard.copy(subscriptionUrl)
        vibrate('tap')
    }

    const showLink = !config.baseSettings.hideGetLinkButton

    // Also opened from the TV hint in ConnectSection, so it must stay mounted
    // even when the card itself is hidden.
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
            transitionProps={{ duration: 0 }}
        >
            {qrOpen && qrSrc && <img alt={subscriptionUrl} className={classes.qr} src={qrSrc} />}
            <p className={classes.qrText}>{t('qrText')}</p>
        </Modal>
    )

    if (!showLink && !cabinetUrl) return qrModal

    return (
        <section aria-label={t('linkCaption')} className={clsx(classes.card, classes.linkCard)}>
            {showLink ? (
                <div className={classes.linkField}>
                    <button
                        aria-label={t('copyLinkFull')}
                        className={classes.linkTextWrap}
                        onClick={copy}
                        type="button"
                    >
                        <span className={classes.linkCaption}>{t('linkCaption')}</span>
                        <span className={classes.linkText} title={subscriptionUrl}>
                            {shortLink(subscriptionUrl)}
                        </span>
                    </button>
                    <button
                        aria-label={clipboard.copied ? t('copied') : t('copyLinkFull')}
                        className={clsx(
                            classes.qrBtn,
                            classes.copyIconBtn,
                            clipboard.copied && classes.copyBtnDone
                        )}
                        onClick={copy}
                        title={t('copyLink')}
                        type="button"
                    >
                        {clipboard.copied ? (
                            <IconCheck aria-hidden size={19} stroke={2.5} />
                        ) : (
                            <IconCopy aria-hidden size={19} stroke={2} />
                        )}
                    </button>
                    <button
                        aria-label={t('showQr')}
                        className={classes.qrBtn}
                        onClick={() => {
                            vibrate('tap')
                            setQrOpen(true)
                        }}
                        title={t('showQr')}
                        type="button"
                    >
                        <IconQrcode aria-hidden size={20} stroke={2} />
                    </button>
                    {cabinetUrl && (
                        <a
                            aria-label={`${t('cabinet')} — ${hostOf(cabinetUrl)}`}
                            className={classes.cabinetBtn}
                            href={cabinetUrl}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            <IconUserCircle aria-hidden size={18} stroke={2} />
                            {t('cabinetShort')}
                        </a>
                    )}
                    <span aria-live="polite" className={classes.visuallyHidden}>
                        {clipboard.copied ? t('copied') : ''}
                    </span>
                </div>
            ) : (
                cabinetUrl && (
                    <a
                        className={classes.tile}
                        href={cabinetUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        <span aria-hidden className={classes.iconSquare}>
                            <IconUserCircle size={18} stroke={2} />
                        </span>
                        <span className={classes.tileText}>
                            <span className={classes.tileTitle}>{t('cabinet')}</span>
                            <span className={classes.tileCaption}>{hostOf(cabinetUrl)}</span>
                        </span>
                        <IconExternalLink
                            aria-hidden
                            className={classes.tileTrail}
                            size={16}
                            stroke={2}
                        />
                    </a>
                )
            )}

            {qrModal}
        </section>
    )
}
