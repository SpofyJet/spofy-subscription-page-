import clsx from 'clsx'
import { useId } from 'react'

import classes from '../spofy.module.css'

/** Outer outline of the Spofy shield and the Spartan helmet inside it (viewBox 673 0 362 367). */
const SHIELD =
    'M821.892 4.22852C842.926 -1.41034 865.074 -1.41035 886.108 4.22852L1017.21 39.376C1027.71 42.1885 1035 51.6963 1035 62.5576V178.281C1035 218.016 1015.96 255.344 983.789 278.669L868.088 362.561C859.684 368.654 848.316 368.654 839.912 362.561L724.211 278.669C692.042 255.344 673 218.016 673 178.281V62.5576C673 51.6963 680.294 42.1885 690.785 39.376L821.892 4.22852Z'
const HELMET =
    'M961 142.77C915.823 30.3092 798.843 69.2012 746 102.705C758.7 111.532 786.686 130.953 797.028 138.014C826.965 122.395 850.778 125.111 862.345 129.188C829.143 127.558 807.235 137.563 800.431 142.77L803.152 207.284L827.646 233.77L838.531 197.098L856.902 188.27L843.975 231.053L869.148 265.008L877.994 301L914.054 216.112L893.643 163.822L933.104 201.173C934.692 200.267 940.725 198.184 952.155 197.098C923.307 180.256 914.734 153.862 914.054 142.77L954.877 177.404C956.011 170.84 958.823 154.722 961 142.77Z'

const TOP = 0
const HEIGHT = 367

export type TShieldTone = 'error' | 'muted' | 'ok' | 'trial' | 'warning'

/**
 * The status emblem: the Spofy shield «charged» to the share of the subscription that is left.
 * Below the waterline the helmet is white, above it the helmet takes the status colour,
 * so it stays readable at any level and in both themes.
 */
export function StatusShield({ level, tone }: { level: number; tone: TShieldTone }) {
    const id = useId().replace(/:/g, '')
    const share = Math.max(0, Math.min(1, level))
    const water = TOP + HEIGHT * (1 - share)

    return (
        <svg
            aria-hidden
            className={classes.shield}
            data-tone={tone}
            style={{ '--level': share } as React.CSSProperties}
            viewBox="663 -10 382 387"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <clipPath id={`${id}-in`}>
                    <path d={SHIELD} />
                </clipPath>
                <clipPath id={`${id}-wet`}>
                    <rect
                        className={classes.shieldRise}
                        height={HEIGHT + 20}
                        width="400"
                        x="660"
                        y={water}
                    />
                </clipPath>
                <clipPath id={`${id}-dry`}>
                    <rect
                        className={classes.shieldRise}
                        height="1000"
                        width="400"
                        x="660"
                        y={water - 1000}
                    />
                </clipPath>
                <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
                    <stop className={classes.shieldStopTop} offset="0" />
                    <stop className={classes.shieldStopBottom} offset="1" />
                </linearGradient>
            </defs>
            <path className={classes.shieldBody} d={SHIELD} />
            <g clipPath={`url(#${id}-in)`}>
                <rect
                    className={clsx(classes.shieldFill, classes.shieldRise)}
                    fill={`url(#${id}-fill)`}
                    height={HEIGHT + 20}
                    width="400"
                    x="660"
                    y={water}
                />
                {share > 0 && share < 1 && (
                    <rect
                        className={clsx(classes.shieldLine, classes.shieldRise)}
                        height="6"
                        width="400"
                        x="660"
                        y={water - 3}
                    />
                )}
            </g>
            <path className={classes.shieldHelmetDry} clipPath={`url(#${id}-dry)`} d={HELMET} />
            <path className={classes.shieldHelmetWet} clipPath={`url(#${id}-wet)`} d={HELMET} />
            <path className={classes.shieldEdge} d={SHIELD} />
        </svg>
    )
}
