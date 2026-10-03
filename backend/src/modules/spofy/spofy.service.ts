import { Injectable, Logger } from '@nestjs/common';

import { GetUserByShortUuidCommand, GetUserHwidDevicesCommand } from '@remnawave/backend-contract';

import { AxiosService } from '@common/axios';
import { TypedConfigService } from '@common/config/app-config';

export interface ISpofyPageData {
    renewUrl: string | null;
    trafficUrl: string | null;
    supportUrl: string | null;
    cabinetUrl: string | null;
    bypassDisabled: boolean;
    /** Telegram @nickname, else masked email, else Telegram name; null → page falls back */
    displayName: string | null;
    /** HWID devices connected / allowed (null = unknown or unlimited) */
    devicesUsed: number | null;
    devicesLimit: number | null;
    /** in-page checkout through the bot bridge is configured */
    checkoutEnabled: boolean;
}

interface IUserFacts {
    devicesUsed: number | null;
    devicesLimit: number | null;
    bypassDisabled: boolean;
    displayName: string | null;
}

const CACHE_TTL_MS = 60_000;
const CACHE_ERROR_TTL_MS = 15_000;
const CACHE_MAX_ENTRIES = 5_000;
const LOOKUP_TIMEOUT_MS = 3_000;

const NO_FACTS: IUserFacts = {
    bypassDisabled: false,
    displayName: null,
    devicesUsed: null,
    devicesLimit: null,
};

/** "ivan.petrov@gmail.com" → "iv•••ov@gmail.com"; short local parts keep their first letter only. */
export function maskEmail(email: string): string {
    const at = email.lastIndexOf('@');
    if (at <= 0) return email;
    const local = email.slice(0, at);
    const domain = email.slice(at);
    if (local.length <= 4) return `${local[0]}•••${domain}`;
    return `${local.slice(0, 2)}•••${local.slice(-2)}${domain}`;
}

/**
 * The bot writes "Bot user: {full_name} @{username}" into the Remnawave description
 * (REMNAWAVE_USER_DESCRIPTION_TEMPLATE). Prefer the Telegram nickname, then the email,
 * then the Telegram name — never the technical Remnawave username (user_<tg id>).
 */
export function deriveDisplayName(user: {
    description?: string | null;
    email?: string | null;
}): string | null {
    const description = (user.description ?? '').trim();

    const nick = description
        .match(/(?:^|\s)@([A-Za-z0-9_]{4,32})\b/g)
        ?.pop()
        ?.trim();
    if (nick) return nick;

    if (user.email && user.email.includes('@')) return maskEmail(user.email.trim());

    const afterLabel = description.includes(':')
        ? description.slice(description.indexOf(':') + 1)
        : '';
    const name = afterLabel.replace(/\s+/g, ' ').trim();
    if (name && name.length <= 48) return name;

    return null;
}

/** SPOFY_CHECKOUT_ALLOWLIST="a,b" → only these short UUIDs get in-page checkout (staged rollout). */
export function parseAllowlist(raw: string | null | undefined): Set<string> | null {
    if (!raw || !raw.trim()) return null;
    return new Set(
        raw
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
    );
}

export function isCheckoutAllowed(allowlist: Set<string> | null, shortUuid: string): boolean {
    return allowlist === null || allowlist.has(shortUuid);
}

/**
 * Extra data for the Spofy web page. Only used when serving the HTML page —
 * the raw subscription path never touches this service.
 */
@Injectable()
export class SpofyService {
    private readonly logger = new Logger(SpofyService.name);
    private readonly renewUrl: string | null;
    private readonly trafficUrl: string | null;
    private readonly supportUrl: string | null;
    private readonly cabinetUrl: string | null;
    private readonly bypassOffSquadUuid: string | null;
    private readonly checkoutEnabled: boolean;
    private readonly checkoutAllowlist: Set<string> | null;
    private readonly factsCache = new Map<string, { value: IUserFacts; expiresAt: number }>();

    constructor(
        private readonly configService: TypedConfigService,
        private readonly axiosService: AxiosService,
    ) {
        this.renewUrl = this.readEnv('SPOFY_RENEW_URL');
        this.trafficUrl = this.readEnv('SPOFY_TRAFFIC_URL');
        this.supportUrl = this.readEnv('SPOFY_SUPPORT_URL');
        this.cabinetUrl = this.readEnv('SPOFY_CABINET_URL');
        this.bypassOffSquadUuid = this.readEnv('SPOFY_BYPASS_OFF_SQUAD_UUID');
        this.checkoutEnabled =
            !!this.readEnv('SPOFY_BOT_API_URL') &&
            (this.readEnv('SPOFY_BOT_API_KEY')?.length ?? 0) >= 32;
        this.checkoutAllowlist = parseAllowlist(this.readEnv('SPOFY_CHECKOUT_ALLOWLIST'));

        this.logger.log(
            `Spofy: renew=${!!this.renewUrl} traffic=${!!this.trafficUrl} support=${!!this.supportUrl} cabinet=${!!this.cabinetUrl} bypassOffNotice=${!!this.bypassOffSquadUuid}`,
        );
    }

    /** Never throws: any failure degrades to "no notice" and the Remnawave username. */
    public async getPageData(shortUuid: string): Promise<ISpofyPageData> {
        let facts = NO_FACTS;

        try {
            facts = await this.getUserFacts(shortUuid);
        } catch {
            facts = NO_FACTS;
        }

        return {
            renewUrl: this.renewUrl,
            trafficUrl: this.trafficUrl,
            supportUrl: this.supportUrl,
            cabinetUrl: this.cabinetUrl,
            bypassDisabled: facts.bypassDisabled,
            displayName: facts.displayName,
            devicesUsed: facts.devicesUsed,
            devicesLimit: facts.devicesLimit,
            checkoutEnabled:
                this.checkoutEnabled && isCheckoutAllowed(this.checkoutAllowlist, shortUuid),
        };
    }

    private async getUserFacts(shortUuid: string): Promise<IUserFacts> {
        const now = Date.now();
        const cached = this.factsCache.get(shortUuid);

        if (cached && cached.expiresAt > now) {
            return cached.value;
        }

        let value = NO_FACTS;
        let ttl = CACHE_TTL_MS;

        try {
            const response =
                await this.axiosService.axiosInstance.request<GetUserByShortUuidCommand.Response>({
                    method: GetUserByShortUuidCommand.endpointDetails.REQUEST_METHOD,
                    url: GetUserByShortUuidCommand.url(encodeURIComponent(shortUuid)),
                    timeout: LOOKUP_TIMEOUT_MS,
                });

            const user = response.data?.response;
            const squads = user?.activeInternalSquads ?? [];

            value = {
                bypassDisabled: this.bypassOffSquadUuid
                    ? squads.some((squad) => squad.uuid === this.bypassOffSquadUuid)
                    : false,
                displayName: user ? deriveDisplayName(user) : null,
                devicesUsed: user ? await this.countDevices(user) : null,
                devicesLimit:
                    typeof user?.hwidDeviceLimit === 'number' && user.hwidDeviceLimit > 0
                        ? user.hwidDeviceLimit
                        : null,
            };
        } catch (error) {
            this.logger.warn(
                `User lookup failed, rendering with defaults: ${error instanceof Error ? error.message : error}`,
            );
            value = NO_FACTS;
            ttl = CACHE_ERROR_TTL_MS;
        }

        this.pruneCache(now);
        this.factsCache.set(shortUuid, { value, expiresAt: now + ttl });

        return value;
    }

    /** Connected HWID devices; null when unknown (never blocks the page). */
    private async countDevices(user: { id?: number | string }): Promise<number | null> {
        if (user.id === undefined || user.id === null) return null;
        try {
            const response =
                await this.axiosService.axiosInstance.request<GetUserHwidDevicesCommand.Response>({
                    method: GetUserHwidDevicesCommand.endpointDetails.REQUEST_METHOD,
                    url: GetUserHwidDevicesCommand.url(String(user.id)),
                    timeout: LOOKUP_TIMEOUT_MS,
                });
            const total = response.data?.response?.total;
            return typeof total === 'number' ? total : null;
        } catch {
            return null;
        }
    }

    private pruneCache(now: number): void {
        if (this.factsCache.size < CACHE_MAX_ENTRIES) return;

        for (const [key, entry] of this.factsCache) {
            if (entry.expiresAt <= now) this.factsCache.delete(key);
        }

        if (this.factsCache.size >= CACHE_MAX_ENTRIES) {
            this.factsCache.clear();
        }
    }

    private readEnv(
        key:
            | 'SPOFY_BOT_API_KEY'
            | 'SPOFY_BOT_API_URL'
            | 'SPOFY_BYPASS_OFF_SQUAD_UUID'
            | 'SPOFY_CABINET_URL'
            | 'SPOFY_CHECKOUT_ALLOWLIST'
            | 'SPOFY_RENEW_URL'
            | 'SPOFY_SUPPORT_URL'
            | 'SPOFY_TRAFFIC_URL',
    ): string | null {
        const value = this.configService.get(key)?.trim();
        return value ? value : null;
    }
}
