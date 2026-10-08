const SHIELD =
    'M821.892 4.22852C842.926 -1.41034 865.074 -1.41035 886.108 4.22852L1017.21 39.376C1027.71 42.1885 1035 51.6963 1035 62.5576V178.281C1035 218.016 1015.96 255.344 983.789 278.669L868.088 362.561C859.684 368.654 848.316 368.654 839.912 362.561L724.211 278.669C692.042 255.344 673 218.016 673 178.281V62.5576C673 51.6963 680.294 42.1885 690.785 39.376L821.892 4.22852ZM961 142.77C915.823 30.3092 798.843 69.2012 746 102.705C758.7 111.532 786.686 130.953 797.028 138.014C826.965 122.395 850.778 125.111 862.345 129.188C829.143 127.558 807.235 137.563 800.431 142.77L803.152 207.284L827.646 233.77L838.531 197.098L856.902 188.27L843.975 231.053L869.148 265.008L877.994 301L914.054 216.112L893.643 163.822L933.104 201.173C934.692 200.267 940.725 198.184 952.155 197.098C923.307 180.256 914.734 153.862 914.054 142.77L954.877 177.404C956.011 170.84 958.823 154.722 961 142.77Z';

const TEXT = {
    ru: {
        title: 'Ссылка устарела',
        text: 'Такой подписки больше нет. Обычно так бывает, когда подписку пересоздали или обновили: у неё появилась новая ссылка.',
        hint: 'Актуальная ссылка и все покупки — в боте.',
        bot: 'Открыть бота',
        support: 'Написать в поддержку',
    },
    en: {
        title: 'This link is out of date',
        text: 'This subscription no longer exists. It usually happens when a subscription was re-created or updated and got a new link.',
        hint: 'Your current link and purchases are in the bot.',
        bot: 'Open the bot',
        support: 'Contact support',
    },
} as const;

const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const safeUrl = (value: null | string): null | string =>
    value && /^https:\/\//i.test(value) ? escapeHtml(value) : null;

/** Small branded 404 for a person who opened a dead link in a browser (never for VPN clients). */
export function renderNotFoundPage(options: {
    acceptLanguage?: string;
    botUrl: null | string;
    supportUrl: null | string;
}): string {
    const t = /^\s*ru|,\s*ru/i.test(options.acceptLanguage ?? '') ? TEXT.ru : TEXT.en;
    const lang = t === TEXT.ru ? 'ru' : 'en';
    const bot = safeUrl(options.botUrl);
    const support = safeUrl(options.supportUrl);

    return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="light dark">
<title>Spofy VPN · ${t.title}</title>
<style>
:root{--bg:#f4f6fb;--card:#fff;--text:#0b1220;--muted:#56627d;--line:rgba(11,18,32,.1);--btn:#2b63f5;--btn2:#e9eefc;--btn2t:#1c47c4}
@media(prefers-color-scheme:dark){:root{--bg:#070b18;--card:#0f1730;--text:#f2f5ff;--muted:#9aa6c4;--line:rgba(140,170,255,.18);--btn2:rgba(140,170,255,.14);--btn2t:#9db8ff}}
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:16px;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{width:min(440px,100%);padding:28px 24px;border-radius:24px;background:var(--card);border:1px solid var(--line);text-align:center;box-shadow:0 30px 70px -40px rgba(43,99,245,.55)}
.i{width:76px;height:76px;margin:0 auto 18px;border-radius:24px;display:grid;place-items:center;background:linear-gradient(145deg,#ff7676,#ff4040 45%,#c41d29);box-shadow:0 0 44px -10px rgba(255,64,64,.8)}
.i svg{width:46px;height:46px;fill:#0a0e16}h1{margin:0 0 8px;font-size:24px;line-height:1.2}p{margin:0 0 10px;color:var(--muted)}
.a{display:flex;flex-direction:column;gap:10px;margin-top:20px}a{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:16px;font-weight:700;text-decoration:none}
.p{background:var(--btn);color:#fff}.s{background:var(--btn2);color:var(--btn2t)}
</style></head><body><main>
<div class="i"><svg viewBox="673 0 362 367" aria-hidden="true"><path d="${SHIELD}"/></svg></div>
<h1>${t.title}</h1><p>${t.text}</p><p>${t.hint}</p>
<div class="a">${bot ? `<a class="p" href="${bot}">${t.bot}</a>` : ''}${support ? `<a class="s" href="${support}">${t.support}</a>` : ''}</div>
</main></body></html>`;
}
