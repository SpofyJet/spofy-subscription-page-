import { pickLang, renderSpofyPage } from './spofy-page';

/**
 * Where a payment provider sends the person after an invoice made on the subscription page.
 *
 * The subscription link is a credential, so it is never given to a provider: the provider
 * gets this neutral address, and the browser itself knows where the person came from — the
 * page writes its own address into localStorage when the invoice is created
 * (frontend/src/spofy/checkout/return.ts, the same two keys). This screen reads it and goes
 * straight back; the page then shows the payment's status as usual.
 *
 * Nothing stored (paid in another browser or on another device): a short «payment received,
 * open the bot» screen in the page's look — never the cabinet's login.
 */
/**
 * Three segments on purpose: every two-segment GET is «<shortUuid>/<clientType>» for the
 * upstream ClientTypeMiddleware, which drops the connection on an unknown client type.
 */
export const RETURN_ROUTE = 'payment/return';
export const RETURN_KEY = 'spofy.subpage.return';
export const RETURNED_KEY = 'spofy.subpage.returned';
/** The bot keeps a page invoice for 24 h — the same life as the page's own «pending» entry. */
const RETURN_TTL_MS = 24 * 60 * 60_000;

const TEXT = {
    ru: {
        paid: {
            title: 'Оплата получена',
            text: 'Подписка обновится автоматически в течение нескольких минут.',
            hint: 'Новый срок появится в вашем приложении и в боте — настраивать ничего не нужно.',
        },
        unknown: {
            title: 'Проверяем оплату',
            text: 'Если вы оплатили, подписка обновится автоматически в течение нескольких минут.',
            hint: 'Новый срок появится в вашем приложении и в боте — настраивать ничего не нужно.',
        },
        failed: {
            title: 'Оплата не прошла',
            text: 'Попробуйте ещё раз: откройте страницу подписки или бота и оплатите заново.',
            hint: 'Если деньги всё же списались, напишите в поддержку.',
        },
        bot: 'Открыть бота',
        support: 'Написать в поддержку',
    },
    en: {
        paid: {
            title: 'Payment received',
            text: 'The subscription will update automatically within a few minutes.',
            hint: 'The new term will show in your app and in the bot — there is nothing else to set up.',
        },
        unknown: {
            title: 'Checking the payment',
            text: 'If you have paid, the subscription will update automatically within a few minutes.',
            hint: 'The new term will show in your app and in the bot — there is nothing else to set up.',
        },
        failed: {
            title: 'The payment did not go through',
            text: 'Please try again: open your subscription page or the bot and pay once more.',
            hint: 'If the money was charged anyway, contact support.',
        },
        bot: 'Open the bot',
        support: 'Contact support',
    },
} as const;

/**
 * Runs before anything is drawn. Goes back only to an address on this very site (a stored
 * value that points elsewhere is ignored), marks the tab as «came back from the payment» so
 * the page opens the invoice's status, and shows the screen below if the browser did not
 * leave within 4 s.
 */
const GO_BACK = `(function(){try{var K='${RETURN_KEY}',r=localStorage.getItem(K);if(!r)return;var v=JSON.parse(r);
if(!v||typeof v.u!=='string'||typeof v.t!=='number'||Date.now()-v.t>${RETURN_TTL_MS}){localStorage.removeItem(K);return}
var u=new URL(v.u,location.origin);if(u.origin!==location.origin||u.pathname===location.pathname)return;
try{sessionStorage.setItem('${RETURNED_KEY}',String(Date.now()))}catch(e){}
var d=document.documentElement;d.className='go';setTimeout(function(){d.className=''},4000);
location.replace(u.pathname+u.search)}catch(e){}})();`;

export type TReturnStatus = 'failed' | 'paid' | 'unknown';

/** The provider's own word (`?status=`): «success», «failed», or nothing at all. */
export function returnStatus(status: unknown): TReturnStatus {
    if (status === 'success') return 'paid';
    if (status === 'failed') return 'failed';
    return 'unknown';
}

export function renderReturnPage(options: {
    acceptLanguage?: string;
    botUrl: null | string;
    status: TReturnStatus;
    supportUrl: null | string;
}): string {
    const lang = pickLang(options.acceptLanguage);
    const t = TEXT[lang];
    return renderSpofyPage({
        botUrl: options.botUrl,
        supportUrl: options.supportUrl,
        lang,
        text: { ...t[options.status], bot: t.bot, support: t.support },
        tone: options.status === 'failed' ? 'error' : 'info',
        head: `<style>.go body{visibility:hidden}</style><script>${GO_BACK}</script>`,
    });
}

/**
 * The address given to the bot for the provider: this site, the prefix, the route — nothing
 * about the subscription or the person.
 */
export function returnUrl(origin: string, prefix: string | undefined): string {
    const clean = (prefix ?? '').replace(/^\/+|\/+$/g, '');
    return `${origin}${clean ? `/${clean}` : ''}/spofy-api/${RETURN_ROUTE}`;
}
