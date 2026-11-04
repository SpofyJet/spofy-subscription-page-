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

export function renderLinkPreview(options: { description: string; title: string }): string {
    const title = escapeHtml(options.title || 'Subscription');
    const description = escapeHtml(options.description || '');
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="robots" content="noindex, nofollow" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${title}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
</head>
<body></body>
</html>
`;
}
