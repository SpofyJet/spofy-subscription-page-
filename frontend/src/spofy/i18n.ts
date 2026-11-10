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
    heroExpiredText:
        'Продлите подписку — VPN снова заработает в том же приложении, без настройки.',
    heroDisabledTitle: 'Подписка отключена',
    heroDisabledText:
        'Продлите подписку, чтобы вернуть VPN в том же приложении. Если отключение неожиданное, напишите нам — разберёмся.',
    heroLimitedTitle: 'Трафик закончился',
    heroLimitedText:
        'Докупите трафик — и продолжите пользоваться VPN. Подписка остаётся активной, настройки менять не нужно.',
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
    copyLinkShort: 'Скопировать ссылку',
    copyFailed:
        'Телефон не дал скопировать. Нажмите на ссылку и удерживайте, затем выберите «Скопировать».',
    copyLinkFull: 'Скопировать ссылку на подписку',
    copied: 'Скопировано',
    showQr: 'QR-код для другого устройства',
    qrTitle: 'Подписка для другого устройства',
    qrText: 'Откройте VPN-приложение на другом устройстве и отсканируйте код.',
    close: 'Закрыть',
    writeSupport: 'Написать в поддержку',

    yourSubscription: 'Ваша подписка',
    status: 'Статус',
    remaining: 'Осталось',
    untilDate: 'до {date}',
    ended: 'Закончилась',
    term: 'Срок',
    indefiniteShort: 'Бессрочно',
    unlimited: 'Безлимит',
    usedAmount: 'использовано {used}',
    connectHint: 'Выберите платформу и приложение',
    app: 'Приложение',
    alsoWorks: 'Тоже подходит',
    setupApp: 'Как подключить {name}',
    linkHint: 'Подходит для любого VPN-приложения.',
    qrShort: 'QR-код',
    qrCaption: 'для другого устройства',
    supportShort: 'Поддержка',
    supportCaption: 'ответим в Telegram',
    supportCaptionOther: 'напишите нам',

    help: 'Помощь',
    renewShort: 'Продлить',
    buyGb: 'Купить ГБ',
    validUntilLabel: 'Действует до',
    daysShort: 'дн.',
    heroLeadSub: 'Подписка',
    heroLeadTraffic: 'Трафик',
    wordActive: 'активна',
    wordExpiring: 'заканчивается',
    wordExpired: 'истекла',
    wordDisabled: 'отключена',
    wordLimited: 'закончился',
    daysLeftLine: 'ещё {n} {days}',
    ofLimit: 'из {limit}',
    devices: 'Устройства',
    buyMore: 'Докупить',
    connectA: 'Подключите',
    connectB: 'устройство',
    linkA: 'Ссылка на',
    linkB: 'подписку',
    stepOf: 'Шаг {n} из {total}',
    noTraffic: 'без трафика',
    cabinet: 'Личный кабинет',
    cabinetShort: 'Кабинет',
    instructions: 'Пошаговая инструкция',
    stepsCount: '{n} шага',
    linkCaption: 'Ваша ссылка',
    otherDevice: 'для другого устройства',
    tvHint: 'На телевизоре проще отсканировать QR-код',
    month_one: 'месяц',
    month_few: 'месяца',
    month_many: 'месяцев',
    month_other: 'месяца',
    year_one: 'год',
    year_few: 'года',
    year_many: 'лет',
    year_other: 'года',
    coSub: 'Счёт создан — осталось оплатить',
    coPerMonth: '{price} / мес',
    coUntilLabel: 'Будет действовать до',
    coDevicesChange: 'Устройств станет',
    coTrafficChange: 'Лимит трафика станет',
    coSecure: 'Оплата на защищённой странице платёжной системы',
    coSummaryRenew: 'Продление на {period}',
    coSummaryTariff: '{name} на {period}',
    coSummaryForever: '{name} навсегда',
    coForeverMeta: 'Один платёж — продлевать не нужно',
    periodForever: 'Навсегда',
    priceForever: 'навсегда',
    coSummaryDevices: '+{n} до конца подписки',
    coSummaryTraffic: '+{gb} трафика',
    coStepCreated: 'Счёт создан',
    coStepPay: 'Оплата',
    coStepApply: 'Подписка обновится сама',
    coDoneUntil: 'Подписка действует до {date}',
    coClose: 'Готово',
    coRetry: 'Повторить',
    stripHit: 'Выгодно',
    perMonthShort: '{price}/мес',
    trafficBuy: 'Купить {gb} за {price}',
    coSubExpired: 'VPN заработает сразу после оплаты',
    coMethodMore: 'Другой способ оплаты',
    coMethodLess: 'Скрыть',
    heroRenewFrom: 'Продлить от {price}/мес',
    coSubRenew: 'Сейчас до {date} · дни добавятся',
    coSubRenewPlain: 'Новые дни добавятся к оставшимся — текущий срок не сгорает',
    coPeriodsMore: 'Другие сроки',
    coCrypto: 'Криптовалюта',
    coSubTariff: 'После оплаты VPN продолжит работать в том же приложении',
    coSubDevices: 'Новое место появится сразу после оплаты',
    coSubTraffic: '«Обход» снова заработает сразу после оплаты',
    coSubEnding: 'Подписка заканчивается через {n} {days}',
    coSubEndsToday: 'Подписка заканчивается сегодня',
    coSaving: 'Выгода {saving} по сравнению с оплатой помесячно',
    coUpsell: '{period} — {price}/мес, выгода\u00A0{saving}',
    coUpsellCta: 'Выбрать',
    coTrafficWhat:
        'Трафик нужен только для серверов «💸 Обход». Обычные серверы — без ограничений. Докупленные гигабайты действуют до дня сброса лимита — это день, в который вы купили подписку.',
    coTrafficTrialHint: 'Докупка трафика появится после выбора тарифа — выберите его ниже.',
    coPerGb: '{price} за ГБ',
    coBestGb: 'Выгоднее',
    coRenewTitle: 'Продление подписки',
    coTariffTitle: 'Подписка Spofy',
    coDevicesTitle: 'Устройства',
    coTrafficTitle: 'Трафик',
    coTabRenew: 'Продление',
    coTabTariff: 'Тариф',
    coTabDevices: 'Устройства',
    coTabTraffic: 'Трафик',
    coPeriod: 'Срок',
    coDays: '{n} {days}',
    coBest: 'Выгодно',
    coDevicesNow: 'Сейчас {n} · максимум {max}',
    coDevicesAdd: 'Добавить устройств',
    coDeviceBase: '{price} в месяц за устройство',
    coDeviceProrated: 'считаем за {n} {days} до конца подписки',
    coDeviceFree: 'Входит в ваш тариф',
    coDeviceSomeFree: 'К оплате ({n} входит в тариф бесплатно)',
    coFree: 'бесплатно',
    coAddFreeInBot: 'Добавить бесплатно в боте',
    coUnlimited: 'Безлимит',
    coGb: '{n}\u00A0ГБ',
    coMethod: 'Способ оплаты',
    coTotal: 'К оплате',
    coGetLink: 'Перейти к оплате',
    coLoading: 'Загружаем варианты…',
    coPay: 'Оплатить {price}',
    coPayHint:
        'Завершите платёж в новой вкладке и вернитесь сюда. Статус обновится сам — ничего больше настраивать не нужно.',
    coMinNote: 'Минимальный платёж — {amount}. Остаток {rest} зачислится на баланс.',
    coOtherDevice: 'Оплатить с другого устройства',
    coWaiting: 'Ждём оплату…',
    coPaid: 'Оплата получена — применяем изменения…',
    coDone: 'Оплачено',
    stExpiringIn: 'VPN выключится через\u00a0{left}',
    stExpiringToday: 'VPN выключится сегодня',
    stPaidTill: 'оплачено до {date}',
    stTrialFreeUntil: 'бесплатно, до {date}',
    stTrialEndedOn: 'пробный период закончился {date}',
    stDisabledLine: 'подписку отключили',
    stLimitedLine: 'закончился трафик',
    stLimitedNote:
        'Чтобы вернуть VPN сейчас, докупите трафик\u00a0— гигабайты добавятся после оплаты.',
    stNoDevicesTitle: 'Всё готово к подключению',
    stNoDevicesNote:
        'Нажмите кнопку ниже\u00a0— инструкция проведёт по шагам, и VPN\u00a0заработает.',
    ctaConnect: 'Подключить VPN',
    rowPaidTill: 'Оплачено до',
    inBot: 'в боте',
    ctaPickNote: '{period} · {price}/мес',
    coGoPay: 'Перейти к оплате {price}',
    coDoneSub: 'Оплата получена — всё готово',
    stInBotNote:
        'Продлить, добавить устройства и докупить трафик можно в Telegram-боте — кнопки ↗ откроют его.',
    coOpening: 'Открываем страницу оплаты…',
    coPayOpened:
        'Завершите оплату в новой вкладке и вернитесь сюда. Мы увидим платёж и обновим подписку автоматически.',
    coStuck: 'Уже оплатили, а статус не меняется?',
    coStuckText: 'Напишите в поддержку и назовите номер платежа: {id}',
    coSubTrafficAdd: 'Гигабайты добавятся после оплаты — можно сразу продолжить пользоваться VPN',
    coTrafficWhatLimited:
        'Трафик закончился, поэтому VPN остановлен. После оплаты он сразу заработает. Докупленные гигабайты действуют до дня сброса лимита — это день, в который вы купили подписку.',
    coTrafficAfter: 'После покупки будет доступно {gb}',
    coRecommended: 'Рекомендуем',
    coDoneHint: 'Обновите страницу — и увидите новый срок и лимиты.',
    coRefresh: 'Обновить страницу',
    coTimeout: 'Если вы оплатили, подписка обновится автоматически в течение нескольких минут.',
    coBack: 'Вернуться к выбору',
    coPendingBanner: 'Ждём оплату {price}',
    coPendingOpen: 'Открыть',
    coPendingNotice: 'Есть неоплаченный счёт: {summary}, {price}',
    coPendingNoticeNew:
        'Завершите уже начатую оплату или выберите другой вариант ниже. Если создадите новый счёт, старый не оплачивайте.',
    coPendingNoticeOpen: 'Открыть счёт',
    coPendingDone: 'Оплата прошла — обновляем страницу…',
    coPendingHide: 'Скрыть',
    coSessionExpired: 'Сессия оплаты истекла. Обновите страницу, чтобы продолжить.',
    coReload: 'Обновить страницу',
    coErrRate: 'Слишком много попыток. Подождите пару\u00a0минут.',
    coErrBot: 'Сервис оплаты временно недоступен. Попробуйте позже или продлите в боте.',
    coErrDisabled: 'Оплата на странице сейчас недоступна — продлите подписку в боте.',
    coErrRetry:
        'Другое оформление уже идёт или корзина изменилась. Попробуйте ещё раз через минуту.',
    coErrGeneric: 'Не получилось создать платёж. Попробуйте другой способ оплаты.',
    coErrSession: 'Страница устарела. Обновите её и попробуйте снова.',
    coOpenBot: 'Открыть бота',
    coNothing: 'Сейчас здесь нечего купить.',
    coErrNotInBot: 'Для этой подписки оплата на странице недоступна — продлите её в боте.',
    coErrLoad: 'Не удалось загрузить варианты оплаты. Попробуйте ещё раз или оформите в боте.',
    coErrMethod: 'Этот способ оплаты сейчас недоступен — выберите другой.',
    coErrMethodDown:
        'Этот способ оплаты сейчас не отвечает — выберите другой, например СБП или криптовалюту.',
    coErrMethodSwitched:
        'Этот способ сейчас не отвечает. Выбрали другой — нажмите «Оплатить» ещё раз.',
    coMethodDownNote: '{name} сейчас не отвечает — выберите другой способ.',
    coDownShort: 'сейчас не отвечает',
    coErrLimit: 'Сумма больше лимита этого способа оплаты — выберите другой.',
    coErrRestricted: 'Покупки для этого аккаунта ограничены — напишите в поддержку.',

    /* ── v5: calmer page, three distinct states ── */
    device_one: 'устройство',
    device_few: 'устройства',
    device_many: 'устройств',
    device_other: 'устройства',
    hour_one: 'час',
    hour_few: 'часа',
    hour_many: 'часов',
    hour_other: 'часа',
    step_one: 'шаг',
    step_few: 'шага',
    step_many: 'шагов',
    step_other: 'шага',
    lessThanHour: 'меньше часа',
    home: 'Spofy VPN — главная',

    stActive: 'VPN работает',
    stExpiring: 'Подписка скоро закончится',
    stExpired: 'VPN выключен',
    stDisabled: 'VPN отключён',
    stLimited: 'VPN остановлен',
    stTrial: 'Пробный период',
    stTrialEnded: 'Пробный период закончился',
    stTrialEndedNote:
        'Настройки сохранились. Выберите тариф — после оплаты VPN снова заработает в том же приложении.',
    stLeftUntil: 'оплачено до {date}, ещё {left}',
    stEndsToday: 'оплачено до сегодня, {date}',
    stSubUntil: 'подписка действует до {date}',
    rowPlan: 'Тариф',
    rowPlanForever: 'навсегда',
    rowTerm: 'Срок',
    rowNothingToRenew: 'продлевать не нужно',
    stExpiredOn: 'оплата закончилась {date}',
    stTrialLeft: 'осталось {left}',
    stTrialTitle: 'Осталось {left}',
    stTrialPitch:
        'Выберите тариф до конца пробного периода — VPN продолжит работать без перерыва и новой настройки.',
    stExpiringPitch:
        'Продлите сейчас: новые дни добавятся к оставшимся, настройки останутся.',
    stBypassOff:
        'Обычные серверы работают, а для «Обхода» закончился трафик. Добавьте гигабайты — и он снова заработает.',
    stTrafficLow:
        'Для «Обхода» осталось {left}. Докупите трафик заранее, чтобы он не отключился в нужный момент.',
    stTrafficResets: 'Лимит обновится {date}.',
    stTrafficWait: 'Или дождитесь {date}: лимит обновится бесплатно.',
    stDevicesFull:
        'Все {n} уже подключены. Добавьте место — и подключите следующее устройство по той же инструкции.',
    stDeviceFullOne:
        'Первое устройство уже подключено. Добавьте место для второго — первое останется подключённым.',
    ctaAddDevice: 'Добавить устройство',
    ctaRenewEarly: 'Продлить заранее',
    coDoneNothing:
        'Всё готово. Открывайте своё приложение и пользуйтесь VPN — настраивать ничего не нужно.',
    stAccount: 'Аккаунт {name}',

    rowDevices: 'Устройства',
    rowTraffic: 'Трафик для «Обхода»',
    rowOf: '{used} из {limit}',
    rowBypassOver: 'закончился',
    rowUnlimited: 'без лимита',
    rowUsed: 'израсходовано {used}',
    rowAdd: 'Добавить',
    hintTrafficUnlimited: 'На вашем тарифе трафик не ограничен — пользуйтесь сколько нужно.',
    rowBuy: 'Докупить',
    whatIsThis: 'Что это?',
    hintDevices:
        'Сколько устройств можно подключить одновременно: например, ваш телефон, ноутбук и телефон близкого.',
    hintTraffic:
        'Нужен только для серверов «💸 Обход» — они выручают, когда мобильный интернет ограничен. Обычные серверы — без ограничений.',

    ctaRenew: 'Продлить подписку',
    ctaRenewNow: 'Продлить и включить VPN',
    ctaRenewNowBot: 'Продлить VPN в боте',
    ctaChoosePlan: 'Выбрать тариф',
    ctaRestore: 'Вернуть «Обход»',
    ctaFromMonth: 'от {price}/мес',
    ctaFrom: 'от {price}',

    cnTitle: 'Как подключиться',
    cnLead: 'Выберите своё устройство — шаги появятся ниже.',
    cnLeadExpired: 'Пригодится после продления — на новом телефоне или компьютере.',
    cnPlatforms: 'Ваше устройство',
    cnApps: 'Приложение',
    cnStepDone: 'выполнено',
    cnAddTo: 'Добавить в {name}',
    cnPreparingLink: 'Подготавливаем ссылку…',
    cnLinkError: 'Не удалось подготовить — скопируйте ссылку',
    cnNotOpened: 'Приложение не открылось?',
    cnNotOpenedText:
        'Проверьте, что оно установлено (шаг 1). Или скопируйте ссылку и вставьте её в приложении через «+».',
    cnHelp: 'Не получается подключиться?',
    cnShowGuide: 'Показать инструкцию',
    cnMoreTitle: 'Подключить ещё одно устройство',
    cnMoreLead: 'Пошаговая инструкция для телефона, компьютера и телевизора',
    cnLeadSteps: '{platform} · {steps} · пара минут',
    cnLeadProgress: '{platform} · шаг {n} из {total}',
    cnLeadDone: '{platform} · все шаги пройдены',
    cnChange: 'Другое',
    cnCollapse: 'Свернуть',

    moreQr: 'QR-код для другого устройства',
    moreQrHint: 'Отсканируйте его в приложении на телефоне или телевизоре',
    moreCopy: 'Скопировать ссылку подписки',
    moreCopyHint: 'Это ваш личный ключ — никому его не пересылайте',
    moreCabinet: 'Личный кабинет',
    moreSupport: 'Поддержка',
    moreSupportTg: 'Поможем подключиться в Telegram',
    moreSupportOther: 'Напишите нам — поможем разобраться',

    coContinue: 'Выбрать способ оплаты',
    coBackShort: 'Назад',
    coBestValue: 'Выгоднее всего',
    coPopular: 'Популярный',
    coRowSaving: 'выгода {saving}',
    coSavingLine: 'Вы экономите {saving} — дешевле, чем помесячно',
    coDevicesAddLabel: 'Сколько устройств добавить',
    coDevicesWillBe: 'Станет {total}, сейчас {now}',
    coTrafficWillBe: 'Станет {gb}, сейчас {now}',
    coRenewUntil: 'После оплаты — до {date}',
    coPayFor: 'Вы оплачиваете',
    coChooseTariff: 'Тариф',
    coChangeTariff: 'Сменить',
    coChoosePeriod: 'Срок'
}

type TKey = keyof typeof ru
export type TDict = Partial<Record<TKey, string>>

// Russian ships with the page; other languages load on demand (see ensureLocale).
const DICTS: Partial<Record<TSubscriptionPageLanguageCode, TDict>> = { ru }

/**
 * Loads a language before the page switches to it. Never rejects: if the file cannot be fetched
 * the page still opens, in Russian, and the next attempt tries again.
 */
export async function ensureLocale(lang: TSubscriptionPageLanguageCode): Promise<void> {
    if (lang === 'ru' || DICTS.en) return
    try {
        DICTS.en = (await import('./i18n-en')).default
    } catch {
        // see above
    }
}

export type TSpofyKey = TKey

export function translate(
    lang: TSubscriptionPageLanguageCode,
    key: TKey,
    vars?: Record<string, number | string>
): string {
    const template = DICTS[lang]?.[key] ?? DICTS.en?.[key] ?? ru[key]
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
