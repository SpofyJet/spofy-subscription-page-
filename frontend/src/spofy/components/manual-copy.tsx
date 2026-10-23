import { IconInfoCircle } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'

import { useSpofyT } from '../i18n'
import classes from '../spofy.module.css'

/**
 * Shown when the phone would not let the page copy: the link itself, already selected, in a
 * field the person can press and hold to copy by hand.
 */
export function ManualCopy({ text }: { text: string }) {
    const { t } = useSpofyT()
    const field = useRef<HTMLTextAreaElement>(null)
    useEffect(() => {
        const el = field.current
        if (!el) return
        el.focus({ preventScroll: true })
        el.select()
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [])
    return (
        <div className={classes.manualCopy} role="alert">
            <span className={classes.manualCopyHead}>
                <IconInfoCircle aria-hidden size={18} stroke={2} />
                {t('copyFailed')}
            </span>
            <textarea
                aria-label={t('subscriptionLink')}
                className={classes.manualCopyField}
                onFocus={(event) => event.currentTarget.select()}
                readOnly
                ref={field}
                rows={3}
                spellCheck={false}
                value={text}
            />
            <span className={classes.manualCopyNote}>{t('moreCopyHint')}</span>
        </div>
    )
}
