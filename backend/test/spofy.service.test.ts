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
