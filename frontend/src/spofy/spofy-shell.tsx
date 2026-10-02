import { SpofyShield } from './spofy-shield'
import classes from './spofy.module.css'

/** Static placeholder while the page config loads — no spinner, no motion. */
export function SpofyShell() {
    return (
        <div aria-busy="true" className={classes.shell}>
            <SpofyShield className={classes.shellLogo} title="Spofy VPN" />
        </div>
    )
}
