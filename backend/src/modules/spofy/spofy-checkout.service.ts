import type { LookupFunction } from 'node:net';

import axios, { AxiosError, AxiosInstance } from 'axios';
import { createHash } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { TypedConfigService } from '@common/config/app-config';

import { isCheckoutAllowed, parseAllowlist } from './spofy.service';

const OFFER_TTL_MS = 20_000;
const ACTIVE_CHECK_EVERY_MS = 10_000;
const WINDOW_MS = 10 * 60_000;
const CHECKOUTS_PER_SUBSCRIPTION = 6;
// Behind the DDoS proxy every visitor of a node shares one source address, so this is a
// coarse flood guard; the per-subscription limit is the real one.
const CHECKOUTS_PER_IP = 200;
const MAX_TRACKED = 5_000;
/** A payment method that failed this many times within the window is shown as down. */
const METHOD_DOWN_FAILURES = 2;
const METHOD_DOWN_WINDOW_MS = 10 * 60_000;

/** Resolve every hostname to a fixed IP (talk to the bot's origin, bypassing the DDoS proxy). */
function pinnedLookup(ip: string): LookupFunction {
    const family = ip.includes(':') ? 6 : 4;
    return ((
        _hostname: string,
        options: { all?: boolean } | undefined,
        callback: (...args: unknown[]) => void,
    ) => {
        if (options && options.all) callback(null, [{ address: ip, family }]);
        else callback(null, ip, family);
    }) as unknown as LookupFunction;
}

/** Funnel events the page may report (anything else is rejected). */
export const FUNNEL_EVENTS = new Set([
    'view',
    'sheet_open',
    'pay_click',
    'pay_open',
    'pay_return',
    'pay_done',
    'pay_back',
    'pay_timeout',
]);
const FUNNEL_TABS = new Set(['renew', 'devices', 'traffic']);
const FUNNEL_KINDS = new Set(['card', 'sbp', 'crypto', 'stars', 'other']);
const EVENTS_PER_SUBSCRIPTION = 200;

export function platformOf(userAgent: string | undefined): string {
    const ua = userAgent ?? '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    if (/Windows|Macintosh|Linux|X11/i.test(ua)) return 'desktop';
    return 'other';
}

export interface ICheckoutBody {
    kind: 'devices' | 'renew' | 'tariff' | 'traffic';
    payment_method: string;
    payment_option?: null | string;
    period_days?: null | number;
    devices?: null | number;
    traffic_gb?: null | number;
    tariff_id?: null | number;
}

/**
 * Proxy to the bot's /cabinet/spofy-subpage bridge. The bridge key never reaches the
 * browser; this service adds caching and rate limits on top of the bridge's own rules
 * (the bridge never spends the user's balance — it only creates top-up links).
 */
/** FastAPI `detail`: a string, `{code, message}` or a validation list → short text (≤ 200 chars). */
export function bridgeDetail(data: unknown): null | string {
    const detail = (data as { detail?: unknown } | null | undefined)?.detail;
    let text: null | string = null;
    if (typeof detail === 'string') text = detail;
    else if (Array.isArray(detail)) {
        text = detail
            .map((item) => (item as { msg?: unknown })?.msg)
            .filter((msg): msg is string => typeof msg === 'string')
            .join('; ');
    } else if (detail && typeof detail === 'object') {
        const { message, code } = detail as { code?: unknown; message?: unknown };
        text = typeof message === 'string' ? message : typeof code === 'string' ? code : null;
    }
    return text ? text.slice(0, 200) : null;
}

@Injectable()
export class SpofyCheckoutService {
    private readonly logger = new Logger(SpofyCheckoutService.name);
    private readonly http: AxiosInstance | null;
    private readonly allowlist: Set<string> | null;
    private readonly offerCache = new Map<string, { value: unknown; expiresAt: number }>();
    /** Rate-limit stamps (`sub:<uuid>`, `ip:<addr>`) — separate from event stamps so a flood
     * of /event posts can never wipe the checkout limits. */
    private readonly rateHits = new Map<string, number[]>();
    /** Funnel-event stamps per subscription (`ev:<uuid>`). */
    private readonly eventHits = new Map<string, number[]>();
    private readonly lastActiveCheck = new Map<string, { expiresAt: number }>();
    private readonly methodFailures = new Map<string, number[]>();

    constructor(private readonly configService: TypedConfigService) {
        const url = this.configService.get('SPOFY_BOT_API_URL')?.trim();
        const key = this.configService.get('SPOFY_BOT_API_KEY')?.trim();
        const ip = this.configService.get('SPOFY_BOT_API_IP')?.trim();
        this.allowlist = parseAllowlist(this.configService.get('SPOFY_CHECKOUT_ALLOWLIST'));
        const lookup = ip ? pinnedLookup(ip) : undefined;

        this.http =
            url && key && key.length >= 32
                ? axios.create({
                      baseURL: `${url.replace(/\/+$/, '')}/cabinet/spofy-subpage`,
                      timeout: 15_000,
                      headers: {
                          'X-Spofy-Subpage-Key': key,
                          'user-agent': 'Spofy Subscription Page',
                      },
                      httpAgent: new http.Agent({ keepAlive: true, lookup }),
                      httpsAgent: new https.Agent({ keepAlive: true, lookup }),
                  })
                : null;

        this.logger.log(
            `Spofy checkout: ${this.http ? 'enabled' : 'disabled'}${ip ? ' (pinned IP)' : ''}`,
        );
    }

    public get enabled(): boolean {
        return this.http !== null;
    }

    public allows(shortUuid: string): boolean {
        return this.enabled && isCheckoutAllowed(this.allowlist, shortUuid);
    }

    public async offer(shortUuid: string): Promise<unknown> {
        const now = Date.now();
        const cached = this.offerCache.get(shortUuid);
        if (cached && cached.expiresAt > now) return this.withMethodHealth(cached.value);

        const value = await this.call('get', `/${encodeURIComponent(shortUuid)}/offer`);
        this.trimCache(this.offerCache);
        this.offerCache.set(shortUuid, { value, expiresAt: now + OFFER_TTL_MS });
        return this.withMethodHealth(value);
    }

    /** Payment methods the bot could not create a payment with a moment ago (served fresh, not cached). */
    private downMethods(): Set<string> {
        const now = Date.now();
        const down = new Set<string>();
        for (const [method, times] of this.methodFailures) {
            const recent = times.filter((t) => now - t < METHOD_DOWN_WINDOW_MS);
            if (recent.length >= METHOD_DOWN_FAILURES) down.add(method);
            if (recent.length === 0) this.methodFailures.delete(method);
            else this.methodFailures.set(method, recent);
        }
        return down;
    }

    private withMethodHealth(value: unknown): unknown {
        const down = this.downMethods();
        const offer = value as { payment_methods?: { id?: string }[] } | null;
        if (down.size === 0 || !offer || !Array.isArray(offer.payment_methods)) return value;
        return {
            ...offer,
            payment_methods: offer.payment_methods.map((m) =>
                typeof m?.id === 'string' && down.has(m.id) ? { ...m, down: true } : m,
            ),
        };
    }

    public recordMethodFailure(method: string): void {
        this.trimStamps(this.methodFailures, METHOD_DOWN_WINDOW_MS);
        const list = this.methodFailures.get(method) ?? [];
        list.push(Date.now());
        this.methodFailures.set(method, list);
    }

    public async checkout(
        shortUuid: string,
        body: ICheckoutBody,
        clientIp: string,
    ): Promise<unknown> {
        const keys: [string, number][] = [
            [`sub:${shortUuid}`, CHECKOUTS_PER_SUBSCRIPTION],
            [`ip:${clientIp}`, CHECKOUTS_PER_IP],
        ];
        for (const [key, max] of keys) this.checkLimit(key, max);
        // Reserve the slots synchronously (no await between check and reserve), so parallel
        // requests cannot all slip under the limit; give them back if no payment was created.
        const slots = keys.map(([key]) => [key, this.hit(this.rateHits, key)] as const);
        this.offerCache.delete(shortUuid);
        try {
            const result = await this.call(
                'post',
                `/${encodeURIComponent(shortUuid)}/checkout`,
                body,
            );
            this.methodFailures.delete(body.payment_method);
            return result;
        } catch (error) {
            for (const [key, stamp] of slots) this.release(this.rateHits, key, stamp);
            const response = (
                error as { getResponse?: () => { detail?: unknown; status?: number } }
            )?.getResponse?.();
            const detail = response?.detail ?? '';
            // «Failed to create Platega payment» / «Platega is temporarily unavailable»: that
            // provider is failing, not the customer's input — any bridge 503 means the same.
            if (
                (typeof detail === 'string' &&
                    /failed to create .*payment|temporarily unavailable/i.test(detail)) ||
                response?.status === 503
            ) {
                this.recordMethodFailure(body.payment_method);
            }
            throw error;
        }
    }

    /**
     * One log line per funnel event: `SPOFY_EVENT {"e":"pay_open","p":"ios","t":"renew","k":"sbp","s":"3fa9c1d2e4"}`.
     * `s` is a short hash of the subscription (counting people without storing who).
     */
    public recordEvent(
        shortUuid: string,
        body: { e: string; k?: unknown; t?: unknown },
        userAgent: string | undefined,
    ): void {
        if (!FUNNEL_EVENTS.has(body.e)) throw new HttpException({ code: 'invalid_body' }, 422);
        const key = `ev:${shortUuid}`;
        if (this.recent(this.eventHits, key).length >= EVENTS_PER_SUBSCRIPTION) return;
        this.hit(this.eventHits, key);
        const payload: Record<string, string> = {
            e: body.e,
            p: platformOf(userAgent),
            s: createHash('sha256').update(shortUuid).digest('hex').slice(0, 10),
        };
        if (typeof body.t === 'string' && FUNNEL_TABS.has(body.t)) payload.t = body.t;
        if (typeof body.k === 'string' && FUNNEL_KINDS.has(body.k)) payload.k = body.k;
        this.logger.log(`SPOFY_EVENT ${JSON.stringify(payload)}`);
    }

    public async status(shortUuid: string, method: string, paymentId: string): Promise<unknown> {
        const key = `${shortUuid}:${method}:${paymentId}`;
        const now = Date.now();
        const last = this.lastActiveCheck.get(key);
        const active = !last || last.expiresAt <= now;
        if (active) {
            this.trimCache(this.lastActiveCheck);
            this.lastActiveCheck.set(key, { expiresAt: now + ACTIVE_CHECK_EVERY_MS });
        }
        return this.call(
            'get',
            `/${encodeURIComponent(shortUuid)}/payments/${encodeURIComponent(method)}/${encodeURIComponent(paymentId)}`,
            undefined,
            { active: active ? '1' : '0' },
        );
    }

    private recent(map: Map<string, number[]>, key: string): number[] {
        const now = Date.now();
        return (map.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    }

    private checkLimit(key: string, max: number): void {
        if (this.recent(this.rateHits, key).length >= max) {
            throw new HttpException({ code: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    private hit(map: Map<string, number[]>, key: string): number {
        const recent = this.recent(map, key);
        let stamp = Date.now();
        while (recent.includes(stamp)) stamp += 0.001;
        recent.push(stamp);
        this.trimStamps(map, WINDOW_MS);
        map.set(key, recent);
        return stamp;
    }

    private release(map: Map<string, number[]>, key: string, stamp: number): void {
        const recent = map.get(key);
        const index = recent?.indexOf(stamp) ?? -1;
        if (recent && index >= 0) recent.splice(index, 1);
    }

    /**
     * Bound a stamps map (rate limits, funnel events, method failures) without ever clearing
     * it: first drop entries whose stamps all expired, then the oldest tenth if it is still
     * over the bound. A map.clear() here would let one flood reset every limit at once.
     */
    private trimStamps(map: Map<string, number[]>, windowMs: number): void {
        if (map.size < MAX_TRACKED) return;
        const now = Date.now();
        for (const [key, stamps] of map) {
            const fresh = stamps.filter((t) => now - t < windowMs);
            if (fresh.length === 0) map.delete(key);
            else if (fresh.length !== stamps.length) map.set(key, fresh);
        }
        if (map.size < MAX_TRACKED) return;
        const oldestFirst = [...map.keys()].sort(
            (a, b) => (map.get(a)?.[0] ?? 0) - (map.get(b)?.[0] ?? 0),
        );
        for (const key of oldestFirst.slice(0, Math.ceil(oldestFirst.length / 10))) {
            map.delete(key);
        }
    }

    /** Bound a TTL cache the way pruneCache does: drop expired entries, clear only as the last resort. */
    private trimCache(map: Map<string, { expiresAt: number }>): void {
        if (map.size < MAX_TRACKED) return;
        const now = Date.now();
        for (const [key, entry] of map) {
            if (entry.expiresAt <= now) map.delete(key);
        }
        if (map.size >= MAX_TRACKED) map.clear();
    }

    private async call(
        method: 'get' | 'post',
        path: string,
        data?: unknown,
        params?: Record<string, string>,
    ): Promise<unknown> {
        if (!this.http) {
            throw new HttpException({ code: 'checkout_disabled' }, HttpStatus.NOT_FOUND);
        }
        try {
            const response = await this.http.request({ method, url: path, data, params });
            return response.data;
        } catch (error) {
            if (error instanceof AxiosError && error.response) {
                const status = error.response.status;
                const detail = bridgeDetail(error.response.data);
                this.logger.warn(
                    `Bot bridge ${method.toUpperCase()} ${path.split('/')[2] ?? ''} → ${status}` +
                        (detail ? `: ${detail}` : ''),
                );
                throw new HttpException(
                    {
                        code: 'bridge_error',
                        status,
                        detail,
                    },
                    status >= 500 ? HttpStatus.BAD_GATEWAY : status,
                );
            }
            this.logger.warn(
                `Bot bridge unreachable: ${error instanceof Error ? error.message : error}`,
            );
            throw new HttpException({ code: 'bot_unavailable' }, HttpStatus.BAD_GATEWAY);
        }
    }
}
