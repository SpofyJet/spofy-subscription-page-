import type { LookupFunction } from 'node:net';

import axios, { AxiosError, AxiosInstance } from 'axios';
import http from 'node:http';
import https from 'node:https';

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { TypedConfigService } from '@common/config/app-config';

const OFFER_TTL_MS = 20_000;
const ACTIVE_CHECK_EVERY_MS = 10_000;
const WINDOW_MS = 10 * 60_000;
const CHECKOUTS_PER_SUBSCRIPTION = 6;
const CHECKOUTS_PER_IP = 20;
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
@Injectable()
export class SpofyCheckoutService {
    private readonly logger = new Logger(SpofyCheckoutService.name);
    private readonly http: AxiosInstance | null;
    private readonly offerCache = new Map<string, { value: unknown; expiresAt: number }>();
    private readonly hits = new Map<string, number[]>();
    private readonly lastActiveCheck = new Map<string, number>();

    constructor(private readonly configService: TypedConfigService) {
        const url = this.configService.get('SPOFY_BOT_API_URL')?.trim();
        const key = this.configService.get('SPOFY_BOT_API_KEY')?.trim();
        const ip = this.configService.get('SPOFY_BOT_API_IP')?.trim();
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
        this.limit(`sub:${shortUuid}`, CHECKOUTS_PER_SUBSCRIPTION);
        this.limit(`ip:${clientIp}`, CHECKOUTS_PER_IP);
        this.offerCache.delete(shortUuid);
        return this.call('post', `/${encodeURIComponent(shortUuid)}/checkout`, body);
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

    private limit(key: string, max: number): void {
        const now = Date.now();
        const recent = (this.hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
        if (recent.length >= max) {
            throw new HttpException({ code: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
        }
        recent.push(now);
        this.trim(this.hits);
        this.hits.set(key, recent);
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
                const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
                this.logger.warn(
                    `Bot bridge ${method.toUpperCase()} ${path.split('/')[2] ?? ''} → ${status}`,
                );
                throw new HttpException(
                    {
                        code: 'bridge_error',
                        status,
                        detail: typeof detail === 'string' ? detail : null,
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
