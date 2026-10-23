const SHIELD =
    'M821.892 4.22852C842.926 -1.41034 865.074 -1.41035 886.108 4.22852L1017.21 39.376C1027.71 42.1885 1035 51.6963 1035 62.5576V178.281C1035 218.016 1015.96 255.344 983.789 278.669L868.088 362.561C859.684 368.654 848.316 368.654 839.912 362.561L724.211 278.669C692.042 255.344 673 218.016 673 178.281V62.5576C673 51.6963 680.294 42.1885 690.785 39.376L821.892 4.22852ZM961 142.77C915.823 30.3092 798.843 69.2012 746 102.705C758.7 111.532 786.686 130.953 797.028 138.014C826.965 122.395 850.778 125.111 862.345 129.188C829.143 127.558 807.235 137.563 800.431 142.77L803.152 207.284L827.646 233.77L838.531 197.098L856.902 188.27L843.975 231.053L869.148 265.008L877.994 301L914.054 216.112L893.643 163.822L933.104 201.173C934.692 200.267 940.725 198.184 952.155 197.098C923.307 180.256 914.734 153.862 914.054 142.77L954.877 177.404C956.011 170.84 958.823 154.722 961 142.77Z';

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

const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const safeUrl = (value: null | string): null | string =>
    value && /^https:\/\//i.test(value) ? escapeHtml(value) : null;

/**
 * Small branded 404 for a person who opened a dead link in a browser (never for VPN clients).
 * Same look as the subscription page — its font (served from /assets/fonts), header, colours and
 * card — so it does not read as a different, suspicious site.
 */
export function renderNotFoundPage(options: {
    acceptLanguage?: string;
    botUrl: null | string;
    supportUrl: null | string;
}): string {
    const t = /^\s*ru|,\s*ru/i.test(options.acceptLanguage ?? '') ? TEXT.ru : TEXT.en;
    const lang = t === TEXT.ru ? 'ru' : 'en';
    const bot = safeUrl(options.botUrl);
    const support = safeUrl(options.supportUrl);
    const shield = (cls: string) =>
        `<svg class="${cls}" viewBox="673 0 362 367" aria-hidden="true"><path d="${SHIELD}"/></svg>`;

    return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="light dark">
<title>Spofy VPN · ${t.title}</title>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<style>
@font-face{font-family:'Manrope Variable';font-display:swap;font-weight:200 800;src:url(/assets/fonts/manrope-cyrillic.woff2) format('woff2-variations');unicode-range:U+0400-045F,U+0490-0491,U+2116}
@font-face{font-family:'Manrope Variable';font-display:swap;font-weight:200 800;src:url(/assets/fonts/manrope-latin.woff2) format('woff2-variations');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
:root{--bg:#f3f5f9;--card:#fff;--text:#0b1220;--muted:#5b6475;--line:rgba(11,18,32,.1);--accent:#2b63f5;--btn2:rgba(43,99,245,.1);--btn2t:#1c47c4;--err:#d93a40}
@media(prefers-color-scheme:dark){:root{--bg:#070b13;--card:rgba(255,255,255,.045);--text:#e9eef6;--muted:#8b95a7;--line:rgba(255,255,255,.08);--btn2:rgba(77,124,255,.14);--btn2t:#9db8ff;--err:#ff6b70}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;background:var(--bg);color:var(--text);font:16px/1.5 'Manrope Variable',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-text-size-adjust:100%}
.w{width:100%;max-width:560px;margin:0 auto;padding:calc(8px + env(safe-area-inset-top)) 14px 28px}
header{display:flex;align-items:center;gap:10px;min-height:52px;font-size:17.5px;font-weight:800}
.b{width:30px;height:30px;fill:#ff4040;filter:drop-shadow(0 2px 8px rgba(255,64,64,.35))}
main{margin-top:12px;padding:24px 18px;border-radius:22px;background:var(--card);border:1px solid var(--line)}
.s{width:56px;height:58px;margin-bottom:14px;fill:var(--err)}
h1{margin:0 0 8px;font-size:23px;line-height:1.25}
p{margin:0 0 10px;color:var(--muted);font-size:16px}
.a{display:flex;flex-direction:column;gap:10px;margin-top:20px}
a{display:flex;align-items:center;justify-content:center;min-height:52px;padding:0 18px;border-radius:14px;font-weight:700;font-size:16.5px;text-decoration:none;touch-action:manipulation}
.p{background:var(--accent);color:#fff}.q{background:var(--btn2);color:var(--btn2t)}
</style></head><body><div class="w">
<header>${shield('b')}<span>Spofy VPN</span></header>
<main>${shield('s')}
<h1>${t.title}</h1><p>${t.text}</p><p>${t.hint}</p>
<div class="a">${bot ? `<a class="p" href="${bot}">${t.bot}</a>` : ''}${support ? `<a class="q" href="${support}">${t.support}</a>` : ''}</div>
</main></div></body></html>`;
}
