import { pickLang, renderSpofyPage } from './spofy-page';

const TEXT = {
    ru: {
        title: 'Ссылка устарела',
        text: 'VPN по этой ссылке больше не работает. Обычно так бывает, когда подписку пересоздали или обновили: у неё появилась новая ссылка.',
        hint: 'Новая ссылка и все покупки — в боте.',
        bot: 'Открыть бота',
        support: 'Написать в поддержку',
    },
    en: {
        title: 'This link is out of date',
        text: 'VPN no longer works with this link. It usually happens when a subscription was re-created or updated and got a new link.',
        hint: 'Your new link and purchases are in the bot.',
        bot: 'Open the bot',
        support: 'Contact support',
    },
} as const;

/**
 * Small branded 404 for a person who opened a dead link in a browser (never for VPN clients).
 * Russian unless the browser asks for English first (was: English unless Russian was listed).
 */
export function renderNotFoundPage(options: {
    acceptLanguage?: string;
    botUrl: null | string;
    supportUrl: null | string;
}): string {
    const lang = pickLang(options.acceptLanguage);
    return renderSpofyPage({
        botUrl: options.botUrl,
        supportUrl: options.supportUrl,
        lang,
        text: TEXT[lang],
        tone: 'error',
    });
}
