import { IconAlertTriangle, IconPlus } from '@tabler/icons-react'

import { useSpofyT } from '../i18n'
import classes from '../spofy.module.css'
import { ActionLink } from './banner'

export function BypassNotice({ trafficUrl }: { trafficUrl: null | string }) {
    const { t } = useSpofyT()

    return (
        <section className={classes.notice} role="status">
            <span aria-hidden className={classes.noticeIcon}>
                <IconAlertTriangle size={22} stroke={1.9} />
            </span>
            <div className={classes.noticeBody}>
                <p className={classes.noticeText}>{t('bypassText')}</p>
                {trafficUrl && (
                    <ActionLink
                        href={trafficUrl}
                        icon={<IconPlus aria-hidden size={18} stroke={2} />}
                        label={t('buyTraffic')}
                        small
                    />
                )}
            </div>
        </section>
    )
}
