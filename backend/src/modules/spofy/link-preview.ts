/**
 * Link previews (Telegram, WhatsApp, Discord, …) for a subscription link.
 *
 * Preview crawlers send `Accept: *\/*`, so the panel's response rules treat them as a VPN client
 * and refuse the webpage — the crawler gets a dropped connection (502 at the proxy) and the chat
 * keeps an old preview forever. They only need the title and the description, so they get a tiny
 * page with exactly that: no panel request, no subscription data, nothing about the person.
 */

const PREVIEW_BOTS =
    /TelegramBot|WhatsApp|facebookexternalhit|Facebot|meta-externalagent|Discordbot|Twitterbot|Slackbot|vkShare|LinkedInBot|SkypeUriPreview|redditbot|Viber|Iframely|Embedly|Mattermost|Zalo/i;

export function isLinkPreviewBot(userAgent: string | undefined): boolean {
    return !!userAgent && PREVIEW_BOTS.test(userAgent);
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const PREVIEW_FALLBACK_TITLE = 'Spofy VPN — ваша подписка';
export const PREVIEW_FALLBACK_DESCRIPTION = 'Статус подписки и подключение VPN за минуту';

/** The page's public address when the request does not say it (the header filter drops Host). */
export const SITE_ORIGIN = 'https://sub.spofyltd.ru';

/** Origin for absolute og:image/og:url, from the Host the proxy passed; never trusted blindly. */
export function previewOrigin(host: string | undefined): string {
    const clean = (host ?? '').trim().toLowerCase();
    return /^[a-z0-9.-]+(:\d{1,5})?$/.test(clean) ? `https://${clean}` : SITE_ORIGIN;
}

/**
 * og:image lives in /spofy-public (no session cookie needed): a preview bot never has one.
 * og:url is the site origin, not the link itself — the personal token stays out of the markup.
 */
export function renderLinkPreview(options: {
    description: string;
    origin: string;
    title: string;
}): string {
    const title = escapeHtml(options.title || PREVIEW_FALLBACK_TITLE);
    const description = escapeHtml(options.description || PREVIEW_FALLBACK_DESCRIPTION);
    const origin = escapeHtml(options.origin);
    const image = `${origin}/spofy-public/og.png`;
    return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="robots" content="noindex, nofollow" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Spofy VPN" />
<meta property="og:locale" content="ru_RU" />
<meta property="og:url" content="${origin}/" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Spofy VPN" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />
</head>
<body></body>
</html>
`;
}
