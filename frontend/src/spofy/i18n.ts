import { TSubscriptionPageLanguageCode } from '@remnawave/subscription-page-types'
import { useCallback } from 'react'

import { useCurrentLang } from '@entities/app-config-store'

/**
 * Spofy page copy. App names, guide steps and store buttons come from the panel's
 * Subpage Builder config; only page chrome lives here. Russian is the source of truth.
 */
const ru = {
    support: 'Поддержка',
    language: 'Язык',

    statusActive: 'Активна',
    statusExpiring: 'Скоро закончится',
    statusExpired: 'Истекла',
    statusDisabled: 'Отключена',
    statusLimited: 'Трафик закончился',

    validUntil: 'Действует до {date}',
    daysLeftShort: 'ещё {n} дн.',
    endedOn: 'Закончилась {date}',
    indefinite: 'Бессрочная подписка',
    untilEnd: 'до конца подписки',
    lastDay: 'Последний день',
    day_one: 'день',
    day_few: 'дня',
    day_many: 'дней',
    day_other: 'дня',

    traffic: 'Трафик',
    trafficUnlimited: 'Безлимит · использовано {used}',
    trafficOf: '{used} из {limit}',
    trafficLeft: 'осталось {p}%',
    trafficResetDAY: 'Лимит обновляется каждый день',
    trafficResetWEEK: 'Лимит обновляется каждую неделю',
    trafficResetMONTH: 'Лимит обновляется каждый месяц',
    trafficResetMONTH_ROLLING: 'Лимит обновляется каждый месяц',

    renew: 'Продлить подписку',
    buyTraffic: 'Докупить трафик',

    heroExpiredTitle: 'Подписка закончилась',
    heroExpiredText: 'Продлите её — VPN снова заработает. Ничего перенастраивать не нужно.',
    heroDisabledTitle: 'Подписка отключена',
    heroDisabledText: 'Чтобы снова подключиться, продлите подписку или напишите в поддержку.',
    heroLimitedTitle: 'Трафик закончился',
    heroLimitedText: 'Докупите трафик, чтобы продолжить. Подписка остаётся активной.',
    heroLimitedResetText: 'Докупите трафик или дождитесь обновления лимита.',

    bypassText: 'Обходы отключены — лимит трафика исчерпан. Обычные серверы работают.',

    connectTitle: 'Подключите устройство',
    platform: 'Платформа',
    recommended: 'Рекомендуем',
    install: 'Установить',
    addSubscription: 'Добавить подписку',
    howTo: 'Как подключиться',
    otherApps: 'Другие приложения',
    useThisApp: 'Выбрать {name}',

    subscriptionLink: 'Ссылка на подписку',
    copyLink: 'Скопировать',
    copyLinkFull: 'Скопировать ссылку на подписку',
    copied: 'Скопировано',
    showQr: 'QR-код для другого устройства',
    qrTitle: 'Подписка для другого устройства',
    qrText: 'Откройте VPN-приложение на другом устройстве и отсканируйте код.',
    close: 'Закрыть',
    writeSupport: 'Написать в поддержку'
}

type TKey = keyof typeof ru
type TDict = Partial<Record<TKey, string>>

const en: TDict = {
    support: 'Support',
    language: 'Language',
    statusActive: 'Active',
    statusExpiring: 'Ending soon',
    statusExpired: 'Expired',
    statusDisabled: 'Disabled',
    statusLimited: 'Out of traffic',
    validUntil: 'Valid until {date}',
    daysLeftShort: '{n} days left',
    endedOn: 'Ended on {date}',
    indefinite: 'No expiry date',
    untilEnd: 'left on your subscription',
    lastDay: 'Last day',
    day_one: 'day',
    day_other: 'days',
    traffic: 'Traffic',
    trafficUnlimited: 'Unlimited · {used} used',
    trafficOf: '{used} of {limit}',
    trafficLeft: '{p}% left',
    trafficResetDAY: 'Limit resets every day',
    trafficResetWEEK: 'Limit resets every week',
    trafficResetMONTH: 'Limit resets every month',
    trafficResetMONTH_ROLLING: 'Limit resets every month',
    renew: 'Renew subscription',
    buyTraffic: 'Buy more traffic',
    heroExpiredTitle: 'Your subscription has ended',
    heroExpiredText: 'Renew it and the VPN works again. No need to set anything up.',
    heroDisabledTitle: 'Your subscription is disabled',
    heroDisabledText: 'To connect again, renew your subscription or contact support.',
    heroLimitedTitle: 'You are out of traffic',
    heroLimitedText: 'Buy more traffic to continue. Your subscription stays active.',
    heroLimitedResetText: 'Buy more traffic or wait for the limit to reset.',
    bypassText: 'Bypass servers are off — traffic limit reached. Regular servers still work.',
    connectTitle: 'Connect your device',
    platform: 'Platform',
    recommended: 'Recommended',
    install: 'Install',
    addSubscription: 'Add subscription',
    howTo: 'How to connect',
    otherApps: 'Other apps',
    useThisApp: 'Use {name}',
    subscriptionLink: 'Subscription link',
    copyLink: 'Copy',
    copyLinkFull: 'Copy subscription link',
    copied: 'Copied',
    showQr: 'QR code for another device',
    qrTitle: 'Subscription for another device',
    qrText: 'Open the VPN app on your other device and scan this code.',
    close: 'Close',
    writeSupport: 'Contact support'
}

const fr: TDict = {
    support: 'Assistance',
    language: 'Langue',
    statusActive: 'Actif',
    statusExpiring: 'Bientôt expiré',
    statusExpired: 'Expiré',
    statusDisabled: 'Désactivé',
    statusLimited: 'Trafic épuisé',
    validUntil: "Valable jusqu'au {date}",
    daysLeftShort: 'encore {n} j',
    endedOn: 'Terminé le {date}',
    indefinite: "Sans date d'expiration",
    untilEnd: "avant la fin de l'abonnement",
    lastDay: 'Dernier jour',
    day_one: 'jour',
    day_other: 'jours',
    traffic: 'Trafic',
    trafficUnlimited: 'Illimité · {used} utilisés',
    trafficOf: '{used} sur {limit}',
    trafficLeft: 'reste {p} %',
    trafficResetDAY: 'Limite renouvelée chaque jour',
    trafficResetWEEK: 'Limite renouvelée chaque semaine',
    trafficResetMONTH: 'Limite renouvelée chaque mois',
    trafficResetMONTH_ROLLING: 'Limite renouvelée chaque mois',
    renew: "Prolonger l'abonnement",
    buyTraffic: 'Acheter du trafic',
    heroExpiredTitle: 'Votre abonnement est terminé',
    heroExpiredText: 'Prolongez-le et le VPN fonctionnera à nouveau, sans rien reconfigurer.',
    heroDisabledTitle: 'Votre abonnement est désactivé',
    heroDisabledText: "Pour vous reconnecter, prolongez l'abonnement ou contactez l'assistance.",
    heroLimitedTitle: 'Trafic épuisé',
    heroLimitedText: "Achetez du trafic pour continuer. L'abonnement reste actif.",
    heroLimitedResetText: 'Achetez du trafic ou attendez le renouvellement de la limite.',
    bypassText:
        'Contournements désactivés — limite de trafic atteinte. Les serveurs habituels fonctionnent.',
    connectTitle: 'Connectez votre appareil',
    platform: 'Plateforme',
    recommended: 'Recommandé',
    install: 'Installer',
    addSubscription: "Ajouter l'abonnement",
    howTo: 'Comment se connecter',
    otherApps: 'Autres applications',
    useThisApp: 'Utiliser {name}',
    subscriptionLink: "Lien d'abonnement",
    copyLink: 'Copier',
    copyLinkFull: "Copier le lien d'abonnement",
    copied: 'Copié',
    showQr: 'QR code pour un autre appareil',
    qrTitle: 'Abonnement pour un autre appareil',
    qrText: "Ouvrez l'application VPN sur l'autre appareil et scannez ce code.",
    close: 'Fermer',
    writeSupport: "Contacter l'assistance"
}

const DICTS: Partial<Record<TSubscriptionPageLanguageCode, TDict>> = { ru, en, fr }

export type TSpofyKey = TKey

export function translate(
    lang: TSubscriptionPageLanguageCode,
    key: TKey,
    vars?: Record<string, number | string>
): string {
    const template = DICTS[lang]?.[key] ?? en[key] ?? ru[key]
    if (!vars) return template
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        vars[name] === undefined ? match : String(vars[name])
    )
}

export function useSpofyT() {
    const lang = useCurrentLang()
    const t = useCallback(
        (key: TKey, vars?: Record<string, number | string>) => translate(lang, key, vars),
        [lang]
    )
    return { t, lang }
}
