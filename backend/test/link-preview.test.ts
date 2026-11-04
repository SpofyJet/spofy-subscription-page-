// Run: npx tsx --tsconfig tsconfig.json --test test/link-preview.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isLinkPreviewBot, renderLinkPreview } from '../src/modules/spofy/link-preview';

test('preview crawlers are recognised, VPN apps and browsers are not', () => {
    for (const ua of [
        'TelegramBot (like TwitterBot)',
        'WhatsApp/2.23.20.0 A',
        'facebookexternalhit/1.1',
        'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
        'Twitterbot/1.0',
        'Mozilla/5.0 (compatible; vkShare; +http://vk.com/dev/Share)',
    ]) {
        assert.equal(isLinkPreviewBot(ua), true, ua);
    }
    for (const ua of [
        undefined,
        '',
        'Happ/4.8.0/Android/179213',
        'v2rayNG/1.10.16',
        'clash.meta/v1.19.12',
        'sing-box 1.12.4',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
    ]) {
        assert.equal(isLinkPreviewBot(ua), false, String(ua));
    }
});

test('the preview carries only title and description, escaped', () => {
    const html = renderLinkPreview({
        title: 'Spofy VPN',
        description: 'Не подключается? "Пишите" <b>сюда</b> & — https://t.me/spofysup',
    });
    assert.match(html, /<title>Spofy VPN<\/title>/);
    assert.match(html, /<meta property="og:title" content="Spofy VPN" \/>/);
    assert.match(
        html,
        /og:description" content="Не подключается\? &#34;Пишите&#34; &#60;b&#62;сюда&#60;\/b&#62; &#38; — https:\/\/t\.me\/spofysup"/,
    );
    assert.doesNotMatch(html, /<script|panelData|<b>/);
});
