// Run: npx tsx --tsconfig tsconfig.json --test test/return.page.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';

import {
    renderReturnPage,
    RETURN_KEY,
    RETURNED_KEY,
    returnStatus,
    returnUrl,
} from '../src/modules/spofy/return.page';

const page = (status: 'failed' | 'paid' | 'unknown', acceptLanguage = 'ru-RU,ru;q=0.9') =>
    renderReturnPage({
        acceptLanguage,
        botUrl: 'https://t.me/spofyvpnbot',
        status,
        supportUrl: null,
    });

/** Runs the screen's inline script the way a browser would, with a fake storage and location. */
function run(stored: null | string, now = 1_800_000_000_000) {
    const script = /<script>([\s\S]*?)<\/script>/.exec(page('paid'))?.[1];
    assert.ok(script, 'the screen carries the go-back script');
    const local = new Map<string, string>(stored === null ? [] : [[RETURN_KEY, stored]]);
    const session = new Map<string, string>();
    const storage = (map: Map<string, string>) => ({
        getItem: (k: string) => map.get(k) ?? null,
        removeItem: (k: string) => void map.delete(k),
        setItem: (k: string, v: string) => void map.set(k, v),
    });
    const went: string[] = [];
    const root = { className: '' };
    vm.runInNewContext(script, {
        Date: { now: () => now },
        document: { documentElement: root },
        JSON,
        localStorage: storage(local),
        location: {
            origin: 'https://sub.spofyltd.ru',
            pathname: '/spofy-api/payment/return',
            replace: (to: string) => went.push(to),
        },
        sessionStorage: storage(session),
        setTimeout: () => 0,
        URL,
    });
    return { hidden: root.className === 'go', local, session, went };
}

const NOW = 1_800_000_000_000;
const entry = (u: unknown, t: unknown = NOW - 60_000) => JSON.stringify({ t, u });

test('the address given to the provider carries nothing about the subscription', () => {
    assert.equal(
        returnUrl('https://sub.spofyltd.ru', undefined),
        'https://sub.spofyltd.ru/spofy-api/payment/return',
    );
    assert.equal(
        returnUrl('https://sub.spofyltd.ru', '/sub/'),
        'https://sub.spofyltd.ru/sub/spofy-api/payment/return',
    );
    // what the bot's bridge accepts: bare https, no query, no fragment
    assert.match(
        returnUrl('https://sub.spofyltd.ru', 'sub'),
        /^https:\/\/[A-Za-z0-9.-]+(\/[A-Za-z0-9._~/-]*)?$/,
    );
});

test('a remembered page address: the browser goes straight back and marks the tab', () => {
    const { went, session, hidden } = run(entry('/Qf_Wtzcw6JXrffn0'));
    assert.deepEqual(went, ['/Qf_Wtzcw6JXrffn0']);
    assert.equal(session.get(RETURNED_KEY), String(NOW));
    assert.equal(hidden, true, 'the fallback screen is not flashed while leaving');
});

test('nothing remembered (paid in another browser): the screen stays', () => {
    const { went, session, hidden } = run(null);
    assert.deepEqual(went, []);
    assert.equal(session.size, 0);
    assert.equal(hidden, false);
});

test('an address that points off this site, is stale or broken is never followed', () => {
    for (const stored of [
        entry('//evil.example/x'),
        entry('https://evil.example/x'),
        entry('javascript:alert(1)'),
        entry('/spofy-api/payment/return'), // itself: no loop
        entry('/Qf_Wtzcw6JXrffn0', NOW - 25 * 60 * 60_000), // older than the invoice can live
        entry(42),
        entry('/Qf_Wtzcw6JXrffn0', 'yesterday'),
        'not json',
        'null',
    ]) {
        const { went, hidden } = run(stored);
        assert.deepEqual(went, [], stored);
        assert.equal(hidden, false, stored);
    }
    // a stale entry is also forgotten
    assert.equal(run(entry('/Qf_Wtzcw6JXrffn0', NOW - 25 * 60 * 60_000)).local.size, 0);
});

test('the screen: «payment received» with the bot button, never a login', () => {
    const html = page('paid');
    assert.match(html, /<h1>Оплата получена<\/h1>/);
    assert.match(html, /href="https:\/\/t\.me\/spofyvpnbot">Открыть бота<\/a>/);
    assert.match(html, /Написать в поддержку/);
    assert.match(html, /class="s info"/);
    assert.doesNotMatch(html, /login|Войти/i);
    assert.match(page('paid', 'en-US,en;q=0.9'), /<h1>Payment received<\/h1>/);
});

test('the provider said «failed» or nothing: the screen does not claim the money arrived', () => {
    assert.match(page('failed'), /<h1>Оплата не прошла<\/h1>/);
    assert.match(page('failed'), /class="s error"/);
    assert.match(page('unknown'), /<h1>Проверяем оплату<\/h1>/);
    assert.doesNotMatch(page('unknown'), /Оплата получена/);
    assert.equal(returnStatus('success'), 'paid');
    assert.equal(returnStatus('failed'), 'failed');
    for (const other of [undefined, '', 'SUCCESS', ['success'], '<script>']) {
        assert.equal(returnStatus(other), 'unknown');
    }
});
