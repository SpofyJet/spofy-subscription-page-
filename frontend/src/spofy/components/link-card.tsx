import { Modal } from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import {
    IconBrandTelegram,
    IconCheck,
    IconCopy,
    IconMessageCircle,
    IconQrcode
} from '@tabler/icons-react'
import clsx from 'clsx'
import { useId, useMemo, useState } from 'react'
import { renderSVG } from 'uqr'

import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { vibrate } from '@shared/utils/vibrate'

import { useAppConfig } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { useSpofyT } from '../i18n'
import classes from '../spofy.module.css'

export function LinkCard({ supportUrl }: { supportUrl: null | string }) {
    const config = useAppConfig()
    const subscription = useSubscription()
    const { t } = useSpofyT()
    const clipboard = useClipboard({ timeout: 2_000 })
    const [qrOpen, setQrOpen] = useState(false)
    const headingId = useId()

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
    if (!showLink && !supportUrl) return null

    const displayUrl = subscriptionUrl.replace(/^https?:\/\//, '')
    const SupportIcon = supportUrl?.includes('t.me') ? IconBrandTelegram : IconMessageCircle

    return (
        <section aria-labelledby={headingId} className={classes.card}>
            <h2 className={classes.sectionTitle} id={headingId}>
                {t('subscriptionLink')}
            </h2>

            {showLink && (
                <div className={classes.linkRow}>
                    <span className={classes.linkText} title={subscriptionUrl}>
                        {displayUrl}
                    </span>
                    <button
                        aria-label={clipboard.copied ? t('copied') : t('copyLinkFull')}
                        className={clsx(
                            classes.btn,
                            classes.btnSecondary,
                            classes.btnSmall,
                            classes.copyBtn,
                            clipboard.copied && classes.copied
                        )}
                        onClick={() => {
                            clipboard.copy(subscriptionUrl)
                            vibrate('tap')
                        }}
                        type="button"
                    >
                        {clipboard.copied ? (
                            <IconCheck aria-hidden size={18} stroke={2.25} />
                        ) : (
                            <IconCopy aria-hidden size={18} stroke={2} />
                        )}
                        {clipboard.copied ? t('copied') : t('copyLink')}
                    </button>
                    <span aria-live="polite" className={classes.visuallyHidden}>
                        {clipboard.copied ? t('copied') : ''}
                    </span>
                </div>
            )}

            <div className={classes.footerLinks}>
                {showLink && (
                    <button
                        className={clsx(classes.btn, classes.btnSecondary)}
                        onClick={() => {
                            vibrate('tap')
                            setQrOpen(true)
                        }}
                        type="button"
                    >
                        <IconQrcode aria-hidden size={20} stroke={2} />
                        {t('showQr')}
                    </button>
                )}
                {supportUrl && (
                    <a
                        className={clsx(classes.btn, classes.btnSecondary)}
                        href={supportUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        <SupportIcon aria-hidden size={20} stroke={2} />
                        {t('writeSupport')}
                    </a>
                )}
            </div>

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
