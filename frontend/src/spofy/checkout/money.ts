import { useCallback } from 'react'

import { useSpofyT } from '../i18n'

/** Rubles from kopeks in the page language; whole rubles drop the decimals. */
export function useMoney() {
    const { lang } = useSpofyT()
    return useCallback(
        (kopeks: number) =>
            new Intl.NumberFormat(lang === 'en' ? 'en-GB' : lang, {
                style: 'currency',
                currency: 'RUB',
                maximumFractionDigits: kopeks % 100 === 0 ? 0 : 2
            }).format(kopeks / 100),
        [lang]
    )
}
