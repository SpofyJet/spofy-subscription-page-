/**
 * Small server-rendered Spofy pages for people who reach the page without a working
 * subscription view: a dead link, the bare domain, the panel being down.
 *
 * Same look as the subscription page (v13 palette, flat cards, red shield, Manrope). Fonts and
 * the icon come from /spofy-public — /assets needs the session cookie, which these pages never
 * set, so links there were silently dropped and the page fell back to the system font.
 */

export const SPOFY_SHIELD_PATH =
    'M821.892 4.22852C842.926 -1.41034 865.074 -1.41035 886.108 4.22852L1017.21 39.376C1027.71 42.1885 1035 51.6963 1035 62.5576V178.281C1035 218.016 1015.96 255.344 983.789 278.669L868.088 362.561C859.684 368.654 848.316 368.654 839.912 362.561L724.211 278.669C692.042 255.344 673 218.016 673 178.281V62.5576C673 51.6963 680.294 42.1885 690.785 39.376L821.892 4.22852ZM961 142.77C915.823 30.3092 798.843 69.2012 746 102.705C758.7 111.532 786.686 130.953 797.028 138.014C826.965 122.395 850.778 125.111 862.345 129.188C829.143 127.558 807.235 137.563 800.431 142.77L803.152 207.284L827.646 233.77L838.531 197.098L856.902 188.27L843.975 231.053L869.148 265.008L877.994 301L914.054 216.112L893.643 163.822L933.104 201.173C934.692 200.267 940.725 198.184 952.155 197.098C923.307 180.256 914.734 153.862 914.054 142.77L954.877 177.404C956.011 170.84 958.823 154.722 961 142.77Z';

export const DEFAULT_BOT_URL = 'https://t.me/spofyvpnbot';
export const DEFAULT_SUPPORT_URL = 'https://t.me/spofysup';

export const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const safeUrl = (value: null | string | undefined): null | string =>
    value && /^https:\/\//i.test(value) ? escapeHtml(value) : null;

/** Russian unless the browser asks for English first. */
export function pickLang(acceptLanguage?: string): 'en' | 'ru' {
    const first = (acceptLanguage ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
    return first.startsWith('en') ? 'en' : 'ru';
}

export interface ISpofyPageText {
    bot: string;
    hint?: string;
    support: string;
    text: string;
    title: string;
}

/** Icon shown above the title: «error» for a dead link, «info» for neutral messages. */
export function renderSpofyPage(options: {
    botUrl: null | string;
    /** trusted markup for the end of <head> (the return screen's «go back» script) */
    head?: string;
    lang: 'en' | 'ru';
    supportUrl: null | string;
    text: ISpofyPageText;
    tone: 'error' | 'info';
}): string {
    const t = options.text;
    const bot = safeUrl(options.botUrl) ?? DEFAULT_BOT_URL;
    const support = safeUrl(options.supportUrl) ?? DEFAULT_SUPPORT_URL;
    const shield = (cls: string) =>
        `<svg class="${cls}" viewBox="673 0 362 367" aria-hidden="true"><path d="${SPOFY_SHIELD_PATH}"/></svg>`;

    return `<!doctype html>
<html lang="${options.lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f0f7ff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#070d1a" media="(prefers-color-scheme: dark)">
<title>${t.title.includes('Spofy') ? t.title : `Spofy VPN · ${t.title}`}</title>
<link rel="icon" href="/spofy-public/favicon.svg" type="image/svg+xml">
<style>
@font-face{font-family:'Manrope Variable';font-display:swap;font-weight:200 800;src:url(/spofy-public/fonts/manrope-cyrillic.woff2) format('woff2-variations');unicode-range:U+0400-045F,U+0490-0491,U+2116}
@font-face{font-family:'Manrope Variable';font-display:swap;font-weight:200 800;src:url(/spofy-public/fonts/manrope-latin.woff2) format('woff2-variations');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
:root{--bg:#f0f7ff;--card:#fff;--text:#0b1f3b;--muted:#3d5a80;--cta:#2563eb;--on-cta:#fff;--btn2:#dbeafe;--btn2t:#0b1f3b;--err:#c4262b;--info:#2563eb}
@media(prefers-color-scheme:dark){:root{--bg:#070d1a;--card:#101729;--text:#f3f6fb;--muted:#a4b3ca;--cta:#60a5fa;--on-cta:#0b1f3b;--btn2:#1a2740;--btn2t:#f3f6fb;--err:#f87171;--info:#60a5fa}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;background:var(--bg);color:var(--text);font:16px/1.5 'Manrope Variable',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-text-size-adjust:100%}
.w{width:100%;max-width:560px;margin:0 auto;padding:calc(8px + env(safe-area-inset-top)) 14px 28px}
header{display:flex;align-items:center;gap:10px;min-height:52px;font-size:17.5px;font-weight:800}
.b{width:30px;height:30px;fill:#ff4040}
main{margin-top:12px;padding:24px 18px;border-radius:16px;background:var(--card)}
.s{width:52px;height:54px;margin-bottom:14px}
.s.error{fill:var(--err)}.s.info{fill:var(--info)}
h1{margin:0 0 8px;font-size:23px;line-height:1.25}
p{margin:0 0 10px;color:var(--muted);font-size:16px}
.a{display:flex;flex-direction:column;gap:10px;margin-top:20px}
a{display:flex;align-items:center;justify-content:center;min-height:52px;padding:0 18px;border-radius:14px;font-weight:700;font-size:16.5px;text-decoration:none;touch-action:manipulation}
.p{background:var(--cta);color:var(--on-cta)}.q{background:var(--btn2);color:var(--btn2t)}
</style>${options.head ?? ''}</head><body><div class="w">
<header>${shield('b')}<span>Spofy VPN</span></header>
<main>${shield(`s ${options.tone}`)}
<h1>${t.title}</h1><p>${t.text}</p>${t.hint ? `<p>${t.hint}</p>` : ''}
<div class="a"><a class="p" href="${bot}">${t.bot}</a><a class="q" href="${support}">${t.support}</a></div>
</main></div></body></html>`;
}

const UNAVAILABLE = {
    ru: {
        title: 'Временные неполадки',
        text: 'Страница подписки сейчас не отвечает. Попробуйте через минуту — обычно всё восстанавливается быстро.',
        hint: 'VPN в приложении при этом обычно продолжает работать.',
        bot: 'Открыть бота',
        support: 'Написать в поддержку',
    },
    en: {
        title: 'Temporary problem',
        text: 'The subscription page is not responding right now. Please try again in a minute.',
        hint: 'VPN in the app usually keeps working meanwhile.',
        bot: 'Open the bot',
        support: 'Contact support',
    },
} as const;

const HOME = {
    ru: {
        title: 'Страница подписки Spofy VPN',
        text: 'Здесь открывается ваша личная ссылка на подписку. Её, а также оплату и продление, вы найдёте в боте.',
        bot: 'Открыть бота',
        support: 'Написать в поддержку',
    },
    en: {
        title: 'Spofy VPN subscription page',
        text: 'Your personal subscription link opens here. Find it, as well as payments and renewals, in the bot.',
        bot: 'Open the bot',
        support: 'Contact support',
    },
} as const;

/** Panel unreachable or the page failed to render: a calm «try again» instead of a 502. */
export function renderUnavailablePage(options: {
    acceptLanguage?: string;
    botUrl: null | string;
    supportUrl: null | string;
}): string {
    const lang = pickLang(options.acceptLanguage);
    return renderSpofyPage({ ...options, lang, text: UNAVAILABLE[lang], tone: 'info' });
}

/** The bare domain opened in a browser. */
export function renderHomePage(options: {
    acceptLanguage?: string;
    botUrl: null | string;
    supportUrl: null | string;
}): string {
    const lang = pickLang(options.acceptLanguage);
    return renderSpofyPage({ ...options, lang, text: HOME[lang], tone: 'info' });
}

/** A real browser asking for HTML — scanners and VPN apps keep the dropped connection. */
export function wantsHtmlPage(headers: { accept?: string; 'user-agent'?: string }): boolean {
    const accept = headers.accept ?? '';
    const ua = headers['user-agent'] ?? '';
    return /text\/html/i.test(accept) && /Mozilla\//.test(ua);
}
