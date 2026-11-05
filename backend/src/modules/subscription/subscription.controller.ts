import { Request, Response } from 'express';

import { Get, Controller, Res, Req, Param, Logger } from '@nestjs/common';

import { TRequestTemplateTypeKeys } from '@remnawave/backend-contract';

import { ClientIp } from '@common/decorators/get-ip';
import { ResolvedShortUuid } from '@common/decorators/get-resolved-short-uuid';
import { IsBrowser } from '@common/decorators/is-browser';

import { isLinkPreviewBot } from '@modules/spofy/link-preview';
import { WebpageService } from '@modules/webpage/webpage.service';

import { SubscriptionService } from './subscription.service';

/** Short UUID shape; anything else (scanners, a pasted newline) must not cost a panel request. */
const SHORT_UUID = /^[A-Za-z0-9_-]{6,64}$/;

@Controller()
export class SubscriptionController {
    private readonly logger = new Logger(SubscriptionController.name);

    constructor(
        private readonly subscriptionService: SubscriptionService,
        private readonly webpageService: WebpageService,
    ) {}

    @Get([':shortUuid', ':shortUuid/:clientType'])
    async root(
        @ClientIp() clientIp: string,
        @ResolvedShortUuid() resolvedShortUuid: string | undefined | null,
        @Req() request: Request,
        @Res() response: Response,
        @Param('shortUuid') shortUuid: string,
        @Param('clientType') clientType: string,
        @IsBrowser() isBrowser: boolean,
    ) {
        // Telegram/WhatsApp/… previews: title and description only, before the panel's response
        // rules (which treat a crawler's «Accept: */*» as a VPN client and drop it).
        if (isLinkPreviewBot(request.headers['user-agent'])) {
            return this.webpageService.serveLinkPreview(response);
        }

        if (!SHORT_UUID.test(resolvedShortUuid ?? shortUuid)) {
            if (isBrowser) return this.webpageService.serveNotFound(request, response);
            response.socket?.destroy();
            return;
        }

        if (isBrowser) {
            return this.webpageService.serveWebpage(
                clientIp,
                request,
                response,
                resolvedShortUuid ?? shortUuid,
            );
        }

        return this.subscriptionService.serveSubscriptionPage(
            clientIp,
            request,
            response,
            resolvedShortUuid ?? shortUuid,
            clientType ? (clientType as TRequestTemplateTypeKeys) : undefined,
        );
    }
}
