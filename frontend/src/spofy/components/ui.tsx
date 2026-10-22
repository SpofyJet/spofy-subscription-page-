import { IconHelpCircle } from '@tabler/icons-react'
import clsx from 'clsx'

import { vibrate } from '@shared/utils/vibrate'

import { useSpofyT } from '../i18n'
import { IAction } from '../page-model'
import classes from '../spofy.module.css'

/**
 * A button for a purchase entry point: opens the sheet (onClick) or the bot (href, new tab).
 * `price` sits on the right of the label, e.g. «Продлить подписку      от 108 ₽/мес».
 */
export function ActionButton(props: {
    action: IAction
    className?: string
    icon?: React.ReactNode
    label: string
    price?: null | string
    /** primary = the screen's one main action (glowing); solid = main action inside a callout */
    variant: 'ghost' | 'primary' | 'secondary' | 'soft' | 'solid'
}) {
    const { action, icon, label, price, variant } = props
    const className = clsx(
        classes.btn,
        variant === 'primary' && clsx(classes.btnPrimary, classes.btnGlow),
        variant === 'secondary' && classes.btnSecondary,
        variant === 'soft' && classes.btnSoft,
        variant === 'solid' && classes.btnPrimary,
        variant === 'ghost' && classes.btnQuiet,
        price && classes.btnSplit,
        props.className
    )
    const body = (
        <>
            <span className={classes.btnLabel}>
                {icon}
                {label}
            </span>
            {price && <span className={clsx(classes.btnPrice, classes.num)}>{price}</span>}
        </>
    )
    if (action.onClick) {
        return (
            <button
                className={className}
                onClick={() => {
                    vibrate('tap')
                    action.onClick!()
                }}
                type="button"
            >
                {body}
            </button>
        )
    }
    return (
        <a className={className} href={action.href} rel="noopener noreferrer" target="_blank">
            {body}
        </a>
    )
}

/** Small «?» next to a word a newcomer may not know; toggles a one-line explanation. */
export function HintToggle({
    controls,
    open,
    onToggle
}: {
    controls: string
    open: boolean
    onToggle: () => void
}) {
    const { t } = useSpofyT()
    return (
        <button
            aria-controls={controls}
            aria-expanded={open}
            aria-label={t('whatIsThis')}
            className={clsx(classes.hintBtn, open && classes.hintBtnOpen)}
            onClick={onToggle}
            type="button"
        >
            <IconHelpCircle aria-hidden size={17} stroke={2} />
        </button>
    )
}
