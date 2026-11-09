import { Modal } from '@mantine/core'
import { IconCheck, IconCopy } from '@tabler/icons-react'
import clsx from 'clsx'

import { vibrate } from '@shared/utils/vibrate'

import { useCopy } from '../copy'
import { useSpofyT } from '../i18n'
import { MantineScope } from '../mantine-scope'
import { useBackToClose } from '../overlay'
import { useQrDataUrl } from '../qr'
import { useQrStore } from '../qr-store'
import classes from '../spofy.module.css'
import { ManualCopy } from './manual-copy'

/** The subscription QR. A separate file so that the page does not wait for Mantine. */
export default function QrModal({ subscriptionUrl }: { subscriptionUrl: string }) {
    const { t } = useSpofyT()
    const qrOpen = useQrStore((state) => state.open)
    const setQrOpen = useQrStore((state) => state.setOpen)
    const qrSrc = useQrDataUrl(qrOpen ? subscriptionUrl : null)
    const { copied, copy, failed } = useCopy()
    useBackToClose(qrOpen, () => setQrOpen(false))

    return (
        <MantineScope>
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
                <button
                    className={clsx(classes.btn, classes.btnPrimary, classes.qrCopy)}
                    onClick={() => {
                        vibrate('tap')
                        void copy(subscriptionUrl, 'qr')
                    }}
                    type="button"
                >
                    {copied === 'qr' ? (
                        <IconCheck aria-hidden size={18} stroke={2.2} />
                    ) : (
                        <IconCopy aria-hidden size={18} stroke={2} />
                    )}
                    {copied === 'qr' ? t('copied') : t('copyLinkFull')}
                </button>
                {failed === 'qr' && <ManualCopy text={subscriptionUrl} />}
                <p className={classes.qrWarn}>{t('moreCopyHint')}</p>
            </Modal>
        </MantineScope>
    )
}
