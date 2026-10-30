import { TView } from '../page-model'
import classes from '../spofy.module.css'

const WIDTH = 1600
const HEIGHT = 1000

/** A deterministic, quiet network mesh: no remote image and no layout work on scroll. */
const nodes = Array.from({ length: 32 }, (_, index) => ({
    id: index,
    x: (index * 347 + 83) % WIDTH,
    y: (index * 191 + 97) % HEIGHT,
    r: index % 7 === 0 ? 3.2 : 1.7
}))

const links = nodes.flatMap((node, index) => {
    const next = nodes[(index + 5) % nodes.length]
    const distance = Math.hypot(node.x - next.x, node.y - next.y)
    return distance < 620 ? [{ key: `${node.id}-${next.id}`, from: node, to: next }] : []
})

/** Full-viewport atmosphere. It is purely decorative and never intercepts taps. */
export function AmbientBackdrop({ view }: { view: TView }) {
    return (
        <div aria-hidden className={classes.backdrop} data-view={view}>
            <div className={classes.backdropAurora} />
            <div className={classes.backdropGrid} />
            <svg
                className={classes.backdropNetwork}
                preserveAspectRatio="xMidYMid slice"
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            >
                <g className={classes.backdropMesh}>
                    {links.map(({ from, key, to }) => (
                        <line key={key} x1={from.x} x2={to.x} y1={from.y} y2={to.y} />
                    ))}
                    {nodes.map((node) => (
                        <circle key={node.id} cx={node.x} cy={node.y} r={node.r} />
                    ))}
                </g>
                <g className={classes.backdropOrbits}>
                    <ellipse cx="1380" cy="290" rx="350" ry="350" />
                    <ellipse cx="1380" cy="290" rx="350" ry="132" />
                    <ellipse cx="1380" cy="290" rx="350" ry="132" transform="rotate(62 1380 290)" />
                    <ellipse cx="120" cy="790" rx="290" ry="290" />
                    <ellipse cx="120" cy="790" rx="290" ry="108" />
                    <ellipse cx="120" cy="790" rx="290" ry="108" transform="rotate(-48 120 790)" />
                </g>
            </svg>
            <div className={classes.backdropNoise} />
            <div className={classes.backdropVignette} />
        </div>
    )
}
