// Run: npx tsx --tsconfig tsconfig.json --test test/spofy.service.test.ts
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SpofyService } from '../src/modules/spofy/spofy.service';

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
test('flag unset -> no panel call', async () => {
    const { s, calls } = make(user([SQUAD]), { SPOFY_BYPASS_OFF_SQUAD_UUID: '' });
    assert.equal((await s.getPageData('u1')).bypassDisabled, false);
    assert.equal(calls.length, 0);
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
