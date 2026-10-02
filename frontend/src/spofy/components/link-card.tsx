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
import { renderSVG } from 'uqr'

import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { vibrate } from '@shared/utils/vibrate'

import { useAppConfig } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { useSpofyT } from '../i18n'
import { useQrStore } from '../qr-store'
import classes from '../spofy.module.css'

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
    const qrSrc = useMemo(
        () =>
            qrOpen
                ? `data:image/svg+xml;utf8,${encodeURIComponent(
                      renderSVG(subscriptionUrl, { whiteColor: '#FFFFFF', blackColor: '#0B1220' })
                  )}`
                : '',
        [qrOpen, subscriptionUrl]
    )

    const showLink = !config.baseSettings.hideGetLinkButton
    if (!showLink && !cabinetUrl) return null

    return (
        <section aria-label={t('linkCaption')} className={clsx(classes.card, classes.linkCard)}>
            {showLink && (
                <div className={classes.linkField}>
                    <span className={classes.linkTextWrap}>
                        <span className={classes.linkCaption}>{t('linkCaption')}</span>
                        <span className={classes.linkText} title={subscriptionUrl}>
                            {subscriptionUrl.replace(/^https?:\/\//, '')}
                        </span>
                    </span>
                    <button
                        aria-label={clipboard.copied ? t('copied') : t('copyLinkFull')}
                        className={clsx(
                            classes.btn,
                            classes.btnSmall,
                            classes.copyBtn,
                            clipboard.copied && classes.copyBtnDone
                        )}
                        onClick={() => {
                            clipboard.copy(subscriptionUrl)
                            vibrate('tap')
                        }}
                        type="button"
                    >
                        {clipboard.copied ? (
                            <IconCheck aria-hidden size={18} stroke={2.5} />
                        ) : (
                            <IconCopy aria-hidden size={18} stroke={2} />
                        )}
                        {clipboard.copied ? t('copied') : t('copyLink')}
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
                    <span aria-live="polite" className={classes.visuallyHidden}>
                        {clipboard.copied ? t('copied') : ''}
                    </span>
                </div>
            )}

            {cabinetUrl && (
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
            )}

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
                {qrOpen && <img alt={subscriptionUrl} className={classes.qr} src={qrSrc} />}
                <p className={classes.qrText}>{t('qrText')}</p>
            </Modal>
        </section>
    )
}
