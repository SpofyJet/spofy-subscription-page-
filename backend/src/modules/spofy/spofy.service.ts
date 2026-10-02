import { Injectable, Logger } from '@nestjs/common';

import { GetUserByShortUuidCommand } from '@remnawave/backend-contract';

import { AxiosService } from '@common/axios';
import { TypedConfigService } from '@common/config/app-config';

export interface ISpofyPageData {
    renewUrl: string | null;
    trafficUrl: string | null;
    supportUrl: string | null;
    cabinetUrl: string | null;
    bypassDisabled: boolean;
}

const CACHE_TTL_MS = 60_000;
const CACHE_ERROR_TTL_MS = 15_000;
const CACHE_MAX_ENTRIES = 5_000;
const LOOKUP_TIMEOUT_MS = 3_000;

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
    private readonly bypassCache = new Map<string, { value: boolean; expiresAt: number }>();

    constructor(
        private readonly configService: TypedConfigService,
        private readonly axiosService: AxiosService,
    ) {
        this.renewUrl = this.readEnv('SPOFY_RENEW_URL');
        this.trafficUrl = this.readEnv('SPOFY_TRAFFIC_URL');
        this.supportUrl = this.readEnv('SPOFY_SUPPORT_URL');
        this.cabinetUrl = this.readEnv('SPOFY_CABINET_URL');
        this.bypassOffSquadUuid = this.readEnv('SPOFY_BYPASS_OFF_SQUAD_UUID');

        this.logger.log(
            `Spofy: renew=${!!this.renewUrl} traffic=${!!this.trafficUrl} support=${!!this.supportUrl} cabinet=${!!this.cabinetUrl} bypassOffNotice=${!!this.bypassOffSquadUuid}`,
        );
    }

    /** Never throws: any failure degrades to "no notice". */
    public async getPageData(shortUuid: string): Promise<ISpofyPageData> {
        let bypassDisabled = false;

        try {
            bypassDisabled = await this.isBypassDisabled(shortUuid);
        } catch {
            bypassDisabled = false;
        }

        return {
            renewUrl: this.renewUrl,
            trafficUrl: this.trafficUrl,
            supportUrl: this.supportUrl,
            cabinetUrl: this.cabinetUrl,
            bypassDisabled,
        };
    }

    private async isBypassDisabled(shortUuid: string): Promise<boolean> {
        if (!this.bypassOffSquadUuid) {
            return false;
        }

        const now = Date.now();
        const cached = this.bypassCache.get(shortUuid);

        if (cached && cached.expiresAt > now) {
            return cached.value;
        }

        let value = false;
        let ttl = CACHE_TTL_MS;

        try {
            const response =
                await this.axiosService.axiosInstance.request<GetUserByShortUuidCommand.Response>({
                    method: GetUserByShortUuidCommand.endpointDetails.REQUEST_METHOD,
                    url: GetUserByShortUuidCommand.url(encodeURIComponent(shortUuid)),
                    timeout: LOOKUP_TIMEOUT_MS,
                });

            const squads = response.data?.response?.activeInternalSquads ?? [];
            value = squads.some((squad) => squad.uuid === this.bypassOffSquadUuid);
        } catch (error) {
            this.logger.warn(
                `Bypass lookup failed, rendering without notice: ${error instanceof Error ? error.message : error}`,
            );
            value = false;
            ttl = CACHE_ERROR_TTL_MS;
        }

        this.pruneCache(now);
        this.bypassCache.set(shortUuid, { value, expiresAt: now + ttl });

        return value;
    }

    private pruneCache(now: number): void {
        if (this.bypassCache.size < CACHE_MAX_ENTRIES) return;

        for (const [key, entry] of this.bypassCache) {
            if (entry.expiresAt <= now) this.bypassCache.delete(key);
        }

        if (this.bypassCache.size >= CACHE_MAX_ENTRIES) {
            this.bypassCache.clear();
        }
    }

    private readEnv(
        key:
            | 'SPOFY_BYPASS_OFF_SQUAD_UUID'
            | 'SPOFY_CABINET_URL'
            | 'SPOFY_RENEW_URL'
            | 'SPOFY_SUPPORT_URL'
            | 'SPOFY_TRAFFIC_URL',
    ): string | null {
        const value = this.configService.get(key)?.trim();
        return value ? value : null;
    }
}
