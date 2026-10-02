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
    const { t, lang } = useSpofyT()
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

    const isTelegram = !!supportUrl?.includes('t.me')
    const SupportIcon = isTelegram ? IconBrandTelegram : IconMessageCircle

    return (
        <section aria-labelledby={headingId} className={clsx(classes.card, classes.linkCard)}>
            <div className={classes.sectionHead}>
                <h2 className={classes.sectionTitle} id={headingId}>
                    {t('linkA')}
                    {lang === 'fr' ? '' : ' '}
                    <span className={clsx(classes.glow, classes.glow_accent)}>{t('linkB')}</span>
                </h2>
                {showLink && <p className={classes.sectionHint}>{t('linkHint')}</p>}
            </div>

            {showLink && (
                <div className={classes.linkField}>
                    <span className={classes.linkText} title={subscriptionUrl}>
                        {subscriptionUrl.replace(/^https?:\/\//, '')}
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
                    <span aria-live="polite" className={classes.visuallyHidden}>
                        {clipboard.copied ? t('copied') : ''}
                    </span>
                </div>
            )}

            <div className={classes.tiles}>
                {showLink && (
                    <button
                        className={classes.tile}
                        onClick={() => {
                            vibrate('tap')
                            setQrOpen(true)
                        }}
                        type="button"
                    >
                        <span aria-hidden className={classes.tileIcon}>
                            <IconQrcode size={20} stroke={1.9} />
                        </span>
                        <span className={classes.tileText}>
                            <span className={classes.tileTitle}>{t('qrShort')}</span>
                            <span className={classes.tileCaption}>{t('qrCaption')}</span>
                        </span>
                    </button>
                )}
                {supportUrl && (
                    <a
                        className={classes.tile}
                        href={supportUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        <span aria-hidden className={classes.tileIcon}>
                            <SupportIcon size={20} stroke={1.9} />
                        </span>
                        <span className={classes.tileText}>
                            <span className={classes.tileTitle}>{t('supportShort')}</span>
                            <span className={classes.tileCaption}>
                                {isTelegram ? t('supportCaption') : t('supportCaptionOther')}
                            </span>
                        </span>
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
