import type { Response } from 'express';

import { Get, Controller, Query, Res } from '@nestjs/common';

import { APP_CONFIG_ROUTE_WO_LEADING_PATH } from '@remnawave/subscription-page-types';

import type { IJwtPayload } from '@common/constants';
import { GetJWTPayload } from '@common/decorators/get-jwt-payload';

import { WebpageService } from './webpage.service';

@Controller()
export class WebpageController {
    constructor(private readonly webpageService: WebpageService) {}

    @Get(APP_CONFIG_ROUTE_WO_LEADING_PATH)
    async getSubscriptionPageConfig(
        @GetJWTPayload() user: IJwtPayload,
        @Query('v') requestedVersion: string | undefined,
        @Res({ passthrough: true }) res: Response,
    ) {
        const { config, version } = await this.webpageService.getSubscriptionPageConfig(user.su);

        // The page asks for ?v=<hash of the config>: a changed config has a new address, so this
        // copy may live in the browser. An old or missing version must not be stored.
        res.set(
            'cache-control',
            requestedVersion === version ? 'private, max-age=86400, immutable' : 'no-store',
        );

        return config;
    }
}
