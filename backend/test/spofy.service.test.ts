// Run: npx tsx --tsconfig tsconfig.json --test test/spofy.service.test.ts
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    deriveDisplayName,
    isCheckoutAllowed,
    maskEmail,
    parseAllowlist,
    SpofyService,
} from '../src/modules/spofy/spofy.service';

const SQUAD = '11111111-1111-1111-1111-111111111111';
const env = (over: Record<string, string | undefined> = {}) => ({
    get: (k: string) =>
        ({
            SPOFY_RENEW_URL: 'https://t.me/spofyvpnbot',
            SPOFY_TRAFFIC_URL: ' ',
            SPOFY_SUPPORT_URL: undefined,
            SPOFY_CABINET_URL: 'https://web.spofyltd.ru',
            SPOFY_BYPASS_OFF_SQUAD_UUID: SQUAD,
            ...over,
        })[k],
});
const axios = (impl: () => Promise<unknown>) => {
    const calls: unknown[] = [];
    return {
        calls,
        svc: { axiosInstance: { request: (cfg: unknown) => (calls.push(cfg), impl()) } },
    };
};
const make = (impl: () => Promise<unknown>, over = {}) => {
    const a = axios(impl);
    return { s: new SpofyService(env(over) as never, a.svc as never), calls: a.calls };
};
const user = (squads: string[]) => async () => ({
    data: { response: { activeInternalSquads: squads.map((uuid) => ({ uuid, name: 'x' })) } },
});

test('urls: trimmed, empty -> null', async () => {
    const { s } = make(user([]));
    const d = await s.getPageData('a');
    assert.equal(d.renewUrl, 'https://t.me/spofyvpnbot');
    assert.equal(d.trafficUrl, null);
    assert.equal(d.supportUrl, null);
    assert.equal(d.cabinetUrl, 'https://web.spofyltd.ru');
});
test('bypassDisabled true when user is in the squad', async () => {
    const { s, calls } = make(user(['x', SQUAD]));
    assert.equal((await s.getPageData('u1')).bypassDisabled, true);
    assert.match(String((calls[0] as { url: string }).url), /by-short-uuid\/u1$/);
});
test('false when not in squad', async () => {
    const { s } = make(user(['x']));
    assert.equal((await s.getPageData('u1')).bypassDisabled, false);
});
test('flag unset -> never bypassDisabled (lookup still runs for the name)', async () => {
    const { s } = make(user([SQUAD]), { SPOFY_BYPASS_OFF_SQUAD_UUID: '' });
    assert.equal((await s.getPageData('u1')).bypassDisabled, false);
});

test('display name: Telegram nick > masked email > Telegram name > null', () => {
    assert.equal(
        deriveDisplayName({ description: 'Bot user: Test Person @test_nick' }),
        '@test_nick',
    );
    assert.equal(
        deriveDisplayName({ description: 'Bot user: Te @abc @second_nick' }),
        '@second_nick',
    );
    assert.equal(
        deriveDisplayName({ description: 'Bot user: Name', email: 'someone.example@mail.test' }),
        'so•••le@mail.test',
    );
    assert.equal(deriveDisplayName({ description: 'Bot user: Test Person' }), 'Test Person');
    assert.equal(deriveDisplayName({ description: '' }), null);
    assert.equal(deriveDisplayName({ description: null, email: null }), null);
});

test('maskEmail keeps short local parts mostly hidden', () => {
    assert.equal(maskEmail('abc@mail.test'), 'a•••@mail.test');
    assert.equal(maskEmail('not-an-email'), 'not-an-email');
});

test('page data carries the derived display name', async () => {
    const { s } = make(async () => ({
        data: { response: { activeInternalSquads: [], description: 'Bot user: X @nick_name' } },
    }));
    assert.equal((await s.getPageData('u9')).displayName, '@nick_name');
});
test('fail open on error / timeout / malformed', async () => {
    for (const impl of [
        async () => {
            throw new Error('boom');
        },
        async () => {
            throw Object.assign(new Error('timeout of 3000ms exceeded'), { code: 'ECONNABORTED' });
        },
        async () => ({ data: null }),
        async () => ({ data: { response: { activeInternalSquads: 'nope' } } }),
    ]) {
        const { s } = make(impl as never);
        const d = await s.getPageData('u1');
        assert.equal(d.bypassDisabled, false);
        assert.equal(d.renewUrl, 'https://t.me/spofyvpnbot');
    }
});
test('cached per user for <=60s', async () => {
    const { s, calls } = make(user([SQUAD]));
    await s.getPageData('u1');
    await s.getPageData('u1');
    await s.getPageData('u2');
    assert.equal(calls.length, 2);
    const realNow = Date.now;
    Date.now = () => realNow() + 61_000;
    try {
        await s.getPageData('u1');
    } finally {
        Date.now = realNow;
    }
    assert.equal(calls.length, 3);
});
test('lookup uses a short timeout', async () => {
    const { s, calls } = make(user([]));
    await s.getPageData('u1');
    assert.equal((calls[0] as { timeout: number }).timeout, 3000);
});

test('checkout allowlist: unset → everyone, set → only listed', () => {
    assert.equal(parseAllowlist(undefined), null);
    assert.equal(parseAllowlist('  '), null);
    assert.equal(isCheckoutAllowed(null, 'abcdef'), true);
    const list = parseAllowlist(' abcdef , ghijkl ,');
    assert.equal(isCheckoutAllowed(list, 'abcdef'), true);
    assert.equal(isCheckoutAllowed(list, 'zzzzzz'), false);
    assert.equal(isCheckoutAllowed(parseAllowlist('none'), 'abcdef'), false);
});

import { bridgeDetail } from '../src/modules/spofy/spofy-checkout.service';

test('bridgeDetail: string, {code,message}, validation list, junk', () => {
    assert.equal(bridgeDetail({ detail: 'Invalid or unavailable payment method' }), 'Invalid or unavailable payment method');
    assert.equal(
        bridgeDetail({ detail: { code: 'tariff_required', message: 'Subscription has no tariff.' } }),
        'Subscription has no tariff.',
    );
    assert.equal(bridgeDetail({ detail: { code: 'tariff_required' } }), 'tariff_required');
    assert.equal(bridgeDetail({ detail: [{ msg: 'field required' }, { msg: 'too big' }] }), 'field required; too big');
    assert.equal(bridgeDetail({ detail: 42 }), null);
    assert.equal(bridgeDetail(null), null);
    assert.equal(bridgeDetail({ detail: 'x'.repeat(500) })?.length, 200);
});

import { SpofyCheckoutService } from '../src/modules/spofy/spofy-checkout.service';

const checkoutService = (call: () => Promise<unknown>) => {
    const service = new SpofyCheckoutService({
        get: (key: string) =>
            ({ SPOFY_BOT_API_URL: 'http://bot.invalid', SPOFY_BOT_API_KEY: 'k'.repeat(40) })[key],
    } as never);
    (service as unknown as { call: () => Promise<unknown> }).call = call;
    return service;
};
const body = { kind: 'renew', payment_method: 'yookassa', period_days: 30 } as const;

test('checkout limit holds under parallel requests (6 per subscription)', async () => {
    const service = checkoutService(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { ok: true };
    });
    const results = await Promise.allSettled(
        Array.from({ length: 12 }, (_, i) => service.checkout('abcdefgh', body, `10.0.0.${i}`)),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 6);
});

test('failed checkouts do not use up the limit', async () => {
    const service = checkoutService(async () => {
        throw new Error('bridge down');
    });
    for (let i = 0; i < 10; i++) {
        await assert.rejects(service.checkout('abcdefgh', body, '10.0.0.1'), /bridge down/);
    }
    (service as unknown as { call: () => Promise<unknown> }).call = async () => ({ ok: true });
    await assert.doesNotReject(service.checkout('abcdefgh', body, '10.0.0.1'));
});

test('many visitors behind one proxy address are not blocked by the per-IP limit', async () => {
    const service = checkoutService(async () => ({ ok: true }));
    for (let i = 0; i < 30; i++) {
        await service.checkout(`sub${String(i).padStart(6, '0')}`, body, '193.23.208.15');
    }
});

import { renderNotFoundPage } from '../src/modules/spofy/not-found.page';
import { platformOf } from '../src/modules/spofy/spofy-checkout.service';

test('not-found page: language, links, escaping, no http links', () => {
    const ru = renderNotFoundPage({
        acceptLanguage: 'ru-RU,ru;q=0.9',
        botUrl: 'https://t.me/spofyvpnbot',
        supportUrl: 'javascript:alert(1)',
    });
    assert.match(ru, /Ссылка устарела/);
    assert.match(ru, /href="https:\/\/t\.me\/spofyvpnbot"/);
    assert.doesNotMatch(ru, /javascript:/);
    const en = renderNotFoundPage({ acceptLanguage: 'en-GB', botUrl: null, supportUrl: null });
    assert.match(en, /out of date/);
    assert.doesNotMatch(en, /<a /);
    const tricky = renderNotFoundPage({ botUrl: 'https://x.test/"><script>1</script>', supportUrl: null });
    assert.doesNotMatch(tricky, /<script>1/);
});

test('funnel events: allowlist, anonymous line, platform from user agent', () => {
    const service = checkoutService(async () => ({}));
    const lines: string[] = [];
    (service as unknown as { logger: { log: (m: string) => void } }).logger = { log: (m) => lines.push(m) };
    service.recordEvent('abcdefgh', { e: 'pay_open', t: 'renew', k: 'sbp' }, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)');
    assert.equal(lines.length, 1);
    const payload = JSON.parse(lines[0].replace('SPOFY_EVENT ', ''));
    assert.deepEqual(Object.keys(payload).sort(), ['e', 'k', 'p', 's', 't']);
    assert.equal(payload.p, 'ios');
    assert.equal(payload.s.length, 10);
    assert.ok(!lines[0].includes('abcdefgh'));
    assert.throws(
        () => service.recordEvent('abcdefgh', { e: 'drop_table' }, ''),
        (error: unknown) => (error as { getStatus?: () => number }).getStatus?.() === 422,
    );
    service.recordEvent('abcdefgh', { e: 'view', t: 'evil', k: '<x>' }, '');
    assert.deepEqual(JSON.parse(lines[1].replace('SPOFY_EVENT ', '')), { e: 'view', p: 'other', s: payload.s });
    assert.equal(platformOf('Mozilla/5.0 (Linux; Android 15)'), 'android');
    assert.equal(platformOf('Mozilla/5.0 (Windows NT 10.0)'), 'desktop');
});

test('a payment method that failed twice is flagged down; success clears it', async () => {
    let mode: 'fail' | 'ok' = 'fail';
    const service = new SpofyCheckoutService({
        get: (key: string) =>
            ({ SPOFY_BOT_API_URL: 'http://bot.invalid', SPOFY_BOT_API_KEY: 'k'.repeat(40) })[key],
    } as never);
    const offer = { payment_methods: [{ id: 'platega' }, { id: 'heleket' }] };
    (service as unknown as { call: (m: string, path: string) => Promise<unknown> }).call = async (
        method,
    ) => {
        if (method === 'get') return offer;
        if (mode === 'fail') {
            const { HttpException } = await import('@nestjs/common');
            throw new HttpException(
                { code: 'bridge_error', status: 500, detail: 'Failed to create Platega payment' },
                502,
            );
        }
        return { ok: true };
    };
    const pay = (id: string) =>
        service.checkout(`sub${id}0000`, { kind: 'renew', payment_method: 'platega', period_days: 30 }, '1.1.1.1');

    const flag = async () =>
        ((await service.offer('subxxxxxx')) as { payment_methods: { id: string; down?: boolean }[] })
            .payment_methods;

    assert.equal((await flag()).find((m) => m.id === 'platega')?.down, undefined);
    await assert.rejects(pay('a'));
    assert.equal((await flag()).find((m) => m.id === 'platega')?.down, undefined, 'one failure is not enough');
    await assert.rejects(pay('b'));
    const methods = await flag();
    assert.equal(methods.find((m) => m.id === 'platega')?.down, true);
    assert.equal(methods.find((m) => m.id === 'heleket')?.down, undefined);
    mode = 'ok';
    await pay('c');
    assert.equal((await flag()).find((m) => m.id === 'platega')?.down, undefined, 'a success clears it');
});
