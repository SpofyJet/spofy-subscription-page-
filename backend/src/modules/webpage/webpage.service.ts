import ejs from 'ejs';
import { Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { exit } from 'node:process';

import { Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import {
    SubscriptionPageRawConfigSchema,
    TSubscriptionPageRawConfig,
    SUBPAGE_DEFAULT_CONFIG_UUID,
} from '@remnawave/subscription-page-types';

import { AxiosService } from '@common/axios';
import { TypedConfigService } from '@common/config/app-config';
import { getAssetsPath, isDevelopment } from '@common/utils';
import { decryptUuid, encryptUuid } from '@common/utils/crypt-utils';

import { SpofyService } from '@modules/spofy';
import {
    PREVIEW_FALLBACK_DESCRIPTION,
    PREVIEW_FALLBACK_TITLE,
    previewOrigin,
    renderLinkPreview,
} from '@modules/spofy/link-preview';

/** Panel edits (meta title/description, guides) reach the page without a restart. */
const CONFIG_REFRESH_MS = 5 * 60_000;

/** The panel's icon library is several times larger than the set a config refers to. */
function withUsedIconsOnly(config: TSubscriptionPageRawConfig): TSubscriptionPageRawConfig {
    const used = new Set<string>();
    const collect = (value: unknown): void => {
        if (Array.isArray(value)) {
            value.forEach(collect);
        } else if (value && typeof value === 'object') {
            for (const [key, inner] of Object.entries(value)) {
                if (key === 'svgIconKey' && typeof inner === 'string') used.add(inner);
                else collect(inner);
            }
        }
    };
    collect(config);
    return {
        ...config,
        svgLibrary: Object.fromEntries(
            Object.entries(config.svgLibrary).filter(([key]) => used.has(key)),
        ),
    };
}

@Injectable()
export class WebpageService implements OnApplicationBootstrap {
    private readonly logger = new Logger(WebpageService.name);
    private readonly internalJwtSecret: string;
    private readonly subpageConfigUuid: string;
    private readonly subpageConfigMap: Map<string, TSubscriptionPageRawConfig> = new Map();
    private readonly subpageConfigVersions: Map<string, string> = new Map();
    private indexTemplate: ejs.TemplateFunction;

    constructor(
        private readonly configService: TypedConfigService,
        private readonly axiosService: AxiosService,
        private readonly jwtService: JwtService,
        private readonly spofyService: SpofyService,
    ) {
        this.internalJwtSecret = this.configService.getOrThrow('INTERNAL_JWT_SECRET');
        this.subpageConfigUuid = this.configService.getOrThrow('SUBPAGE_CONFIG_UUID');
    }

    public async onApplicationBootstrap(): Promise<void> {
        this.indexTemplate = ejs.compile(
            readFileSync(path.join(getAssetsPath(), 'index.html'), 'utf8'),
        );

        const subscriptionPageConfigList = await this.fetchSubscriptionPageConfigList();

        if (subscriptionPageConfigList.length === 0) {
            this.logger.error('[FATAL] Subscription page config list is empty, exiting...');

            exit(1);
        }

        this.logger.log(`Found ${subscriptionPageConfigList.length} subscription page configs.`);

        for (const config of subscriptionPageConfigList) {
            const subscriptionPageConfig =
                await this.axiosService.getSubscriptionPageConfigByUuid(config);

            if (!subscriptionPageConfig.isOk || !subscriptionPageConfig.response) {
                this.logger.error(
                    `[FATAL] Error while fetching one of subpage config: ${config}, exiting...`,
                );

                exit(1);
            }

            const parsedConfig = await SubscriptionPageRawConfigSchema.safeParseAsync(
                subscriptionPageConfig.response.config,
            );

            if (!parsedConfig.success) {
                this.logger.error(
                    `[FATAL] ${config} is not valid: ${JSON.stringify(parsedConfig.error)}`,
                );

                exit(1);
            }

            this.logger.log(`[OK] ${config}`);
            this.rememberConfig(config, parsedConfig.data);
        }

        if (this.subpageConfigMap.size === 0) {
            this.logger.error('[FAILED] At least one SubPage config must be valid!');
            exit(1);
        }

        this.logger.log('[OK] Subpage configs are loaded successfully.');

        setInterval(() => void this.refreshSubpageConfigs(), CONFIG_REFRESH_MS).unref();
    }

    /** Keeps a config with only the icons it uses, and the hash its address is versioned by. */
    private rememberConfig(uuid: string, rawConfig: TSubscriptionPageRawConfig): void {
        const config = withUsedIconsOnly(rawConfig);
        this.subpageConfigMap.set(uuid, config);
        this.subpageConfigVersions.set(
            uuid,
            createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 12),
        );
    }

    /**
     * Re-reads the panel's subpage configs. Unlike the start-up load it never exits: a panel
     * hiccup or an invalid edit keeps the last good config.
     */
    private async refreshSubpageConfigs(): Promise<void> {
        try {
            const uuids = await this.fetchSubscriptionPageConfigList();
            for (const uuid of uuids) {
                const response = await this.axiosService.getSubscriptionPageConfigByUuid(uuid);
                if (!response.isOk || !response.response) continue;
                const parsed = await SubscriptionPageRawConfigSchema.safeParseAsync(
                    response.response.config,
                );
                if (!parsed.success) {
                    this.logger.warn(
                        `Subpage config ${uuid} is not valid, keeping the previous one`,
                    );
                    continue;
                }
                this.rememberConfig(uuid, parsed.data);
            }
        } catch (error) {
            this.logger.warn(`Subpage config refresh failed: ${error}`);
        }
    }

    /** A person with a dead or malformed link gets an explanation. */
    public serveNotFound(req: Request, res: Response): void {
        res.status(404)
            .set({
                'cache-control': 'no-store',
                'content-type': 'text/html; charset=utf-8',
            })
            .send(this.spofyService.renderNotFound(req.headers['accept-language']));
    }

    /** A link preview: the default config's title and description plus the Spofy card image. */
    public serveLinkPreview(req: Request, res: Response): void {
        const { metaTitle, metaDescription } = this.getBaseSettings(null);
        res.status(200)
            .set({ 'cache-control': 'no-store', 'content-type': 'text/html; charset=utf-8' })
            .send(
                renderLinkPreview({
                    title: metaTitle,
                    description: metaDescription,
                    origin: previewOrigin(req.headers.host),
                }),
            );
    }

    /**
     * The panel did not answer or the page failed to render. serveWebpage is only reached by
     * browsers, so a person gets «try again in a minute» instead of the proxy's empty 502.
     */
    public serveUnavailable(req: Request, res: Response): void {
        if (res.headersSent) {
            res.socket?.destroy();
            return;
        }
        res.status(503)
            .set({
                'cache-control': 'no-store',
                'content-type': 'text/html; charset=utf-8',
                'retry-after': '60',
            })
            .send(this.spofyService.renderUnavailable(req.headers['accept-language']));
    }

    public async getSubscriptionPageConfig(
        encryptedSubpageConfigUuid: string,
    ): Promise<{ config: object; version: string | undefined }> {
        const decryptedSubpageConfigUuid = decryptUuid(
            encryptedSubpageConfigUuid,
            this.internalJwtSecret,
        );

        if (!decryptedSubpageConfigUuid) {
            this.logger.error(`[FATAL] SubPage config ${encryptedSubpageConfigUuid} is not valid`);
            throw new NotFoundException();
        }

        const subpageConfig = this.subpageConfigMap.get(decryptedSubpageConfigUuid);

        if (!subpageConfig) {
            this.logger.error(`[FATAL] SubPage config ${decryptedSubpageConfigUuid} not found`);
            throw new NotFoundException();
        }

        return {
            config: subpageConfig,
            version: this.subpageConfigVersions.get(decryptedSubpageConfigUuid),
        };
    }

    private async fetchSubscriptionPageConfigList(): Promise<string[]> {
        const subscriptionPageConfigList = await this.axiosService.getSubscriptionPageConfigList();
        if (!subscriptionPageConfigList.isOk || !subscriptionPageConfigList.response) {
            this.logger.error('Subscription page config list cannot be fetched');
            return [];
        }

        return subscriptionPageConfigList.response.configs.map((config) => config.uuid);
    }

    public getEncryptedSubpageConfigUuid(subpageConfigUuidFromRemnawave: string | null): string {
        return encryptUuid(
            this.getFinalSubpageConfigUuid(subpageConfigUuidFromRemnawave),
            this.internalJwtSecret,
        );
    }

    public getBaseSettings(
        subpageConfigUuid: string | null,
    ): TSubscriptionPageRawConfig['baseSettings'] {
        const subpageConfig = this.subpageConfigMap.get(
            this.getFinalSubpageConfigUuid(subpageConfigUuid),
        );

        if (!subpageConfig) {
            return {
                metaTitle: PREVIEW_FALLBACK_TITLE,
                metaDescription: PREVIEW_FALLBACK_DESCRIPTION,
                showConnectionKeys: false,
                hideGetLinkButton: false,
            };
        }

        return {
            metaTitle: subpageConfig.baseSettings.metaTitle,
            metaDescription: subpageConfig.baseSettings.metaDescription,
            showConnectionKeys: subpageConfig.baseSettings.showConnectionKeys,
            hideGetLinkButton: subpageConfig.baseSettings.hideGetLinkButton,
        };
    }

    private getFinalSubpageConfigUuid(subpageConfigUuid: string | null): string {
        let finalSubpageConfigUuid: string;

        const isDefaultUuid = this.subpageConfigUuid === SUBPAGE_DEFAULT_CONFIG_UUID;

        if (isDefaultUuid && subpageConfigUuid) {
            finalSubpageConfigUuid = subpageConfigUuid;
        } else {
            finalSubpageConfigUuid = this.subpageConfigUuid;
        }

        return finalSubpageConfigUuid;
    }

    private generateJwtForCookie(uuid: string | null): string {
        return this.jwtService.sign(
            {
                sessionId: nanoid(32),
                su: this.getEncryptedSubpageConfigUuid(uuid),
            },
            {
                expiresIn: '33m',
            },
        );
    }

    public async serveWebpage(
        clientIp: string,
        req: Request,
        res: Response,
        shortUuid: string,
    ): Promise<void> {
        try {
            const spofyDataPromise = this.spofyService.getPageData(shortUuid);

            const subscriptionDataResponse = await this.axiosService.getSubscriptionInfo(
                clientIp,
                shortUuid,
            );

            if (!subscriptionDataResponse.isOk || !subscriptionDataResponse.response) {
                // A person with a dead link gets an explanation; any other failure (and every
                // non-browser request) is still dropped as before.
                if (subscriptionDataResponse.notFound) {
                    this.serveNotFound(req, res);
                    return;
                }
                this.serveUnavailable(req, res);
                return;
            }

            const subpageConfigResponse = await this.axiosService.getSubpageConfig(
                shortUuid,
                req.headers,
            );

            if (!subpageConfigResponse.isOk || !subpageConfigResponse.response) {
                this.serveUnavailable(req, res);
                return;
            }

            const subpageConfig = subpageConfigResponse.response;

            if (subpageConfig.webpageAllowed === false) {
                this.logger.log(`Webpage access is not allowed by Remnawave's SRR.`);
                res.socket?.destroy();
                return;
            }

            const baseSettings = this.getBaseSettings(subpageConfig.subpageConfigUuid);

            const subscriptionData = subscriptionDataResponse.response;

            if (!baseSettings.showConnectionKeys) {
                subscriptionData.response.links = [];
                subscriptionData.response.ssConfLinks = {};
            }

            res.cookie('session', this.generateJwtForCookie(subpageConfig.subpageConfigUuid), {
                httpOnly: true,
                secure: !isDevelopment(),
                sameSite: 'lax',
                maxAge: 1_800_000, // 30 minutes
            });

            const spofyData = await spofyDataPromise;

            // Relative, like the page's own call (see checkout/api.ts): the first card waits for
            // these prices, so the request starts with the HTML instead of after the scripts.
            const offerHref = spofyData.checkoutEnabled
                ? `spofy-api/${encodeURIComponent(shortUuid)}/offer`
                : '';

            // The page carries personal data and a fresh session cookie: a browser may keep it only
            // for itself and has to revalidate, a proxy on the way may not keep it at all.
            res.set('cache-control', 'private, no-cache');
            res.type('html').send(
                this.indexTemplate({
                    offerHref,
                    metaTitle: baseSettings.metaTitle,
                    metaDescription: baseSettings.metaDescription,
                    configVersion: this.subpageConfigVersions.get(
                        this.getFinalSubpageConfigUuid(subpageConfig.subpageConfigUuid),
                    ),
                    panelData: Buffer.from(
                        JSON.stringify({ ...subscriptionData, spofy: spofyData }),
                    ).toString('base64'),
                }),
            );
        } catch (error) {
            this.logger.error(`Error in returnWebpage: ${error}`);

            this.serveUnavailable(req, res);
            return;
        }
    }
}
