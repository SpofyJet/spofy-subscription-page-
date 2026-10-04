import type { LookupFunction } from 'node:net';

import axios, { AxiosError, AxiosInstance } from 'axios';
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
    private readonly hits = new Map<string, number[]>();
    private readonly lastActiveCheck = new Map<string, number>();

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
        if (cached && cached.expiresAt > now) return cached.value;

        const value = await this.call('get', `/${encodeURIComponent(shortUuid)}/offer`);
        this.trim(this.offerCache);
        this.offerCache.set(shortUuid, { value, expiresAt: now + OFFER_TTL_MS });
        return value;
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
        const slots = keys.map(([key]) => [key, this.hit(key)] as const);
        this.offerCache.delete(shortUuid);
        try {
            return await this.call('post', `/${encodeURIComponent(shortUuid)}/checkout`, body);
        } catch (error) {
            for (const [key, stamp] of slots) this.release(key, stamp);
            throw error;
        }
    }

    public async status(shortUuid: string, method: string, paymentId: string): Promise<unknown> {
        const key = `${shortUuid}:${method}:${paymentId}`;
        const now = Date.now();
        const active = now - (this.lastActiveCheck.get(key) ?? 0) >= ACTIVE_CHECK_EVERY_MS;
        if (active) {
            this.trim(this.lastActiveCheck);
            this.lastActiveCheck.set(key, now);
        }
        return this.call(
            'get',
            `/${encodeURIComponent(shortUuid)}/payments/${encodeURIComponent(method)}/${encodeURIComponent(paymentId)}`,
            undefined,
            { active: active ? '1' : '0' },
        );
    }

    private recent(key: string): number[] {
        const now = Date.now();
        return (this.hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    }

    private checkLimit(key: string, max: number): void {
        if (this.recent(key).length >= max) {
            throw new HttpException({ code: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    private hit(key: string): number {
        const recent = this.recent(key);
        let stamp = Date.now();
        while (recent.includes(stamp)) stamp += 0.001;
        recent.push(stamp);
        this.trim(this.hits);
        this.hits.set(key, recent);
        return stamp;
    }

    private release(key: string, stamp: number): void {
        const recent = this.hits.get(key);
        const index = recent?.indexOf(stamp) ?? -1;
        if (recent && index >= 0) recent.splice(index, 1);
    }

    private trim(map: Map<string, unknown>): void {
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
