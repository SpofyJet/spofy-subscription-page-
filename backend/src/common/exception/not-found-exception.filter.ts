import { Request, Response } from 'express';

import { ArgumentsHost, Catch, ExceptionFilter, NotFoundException } from '@nestjs/common';

import { renderHomePage, wantsHtmlPage } from '@modules/spofy/spofy-page';

/**
 * Unknown routes still drop the connection (scanners, VPN apps, API probes). One exception: a
 * person who opens the bare domain in a browser gets a short Spofy page with the bot and
 * support instead of the proxy's empty 502.
 */
@Catch(NotFoundException)
export class NotFoundExceptionFilter implements ExceptionFilter {
    catch(exception: NotFoundException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const request = ctx.getRequest<Request>();
        const response = ctx.getResponse<Response>();

        if (isSiteRoot(request.path) && wantsHtmlPage(request.headers) && !response.headersSent) {
            response
                .status(200)
                .set({ 'cache-control': 'no-store', 'content-type': 'text/html; charset=utf-8' })
                .send(
                    renderHomePage({
                        acceptLanguage: request.headers['accept-language'],
                        botUrl: process.env.SPOFY_RENEW_URL ?? null,
                        supportUrl: process.env.SPOFY_SUPPORT_URL ?? null,
                    }),
                );
            return;
        }

        response.socket?.destroy();

        return;
    }
}

/** «/» or the custom prefix root («/sub», «/sub/»). */
function isSiteRoot(path: string): boolean {
    if (path === '/' || path === '') return true;
    const prefix = (process.env.CUSTOM_SUB_PREFIX ?? '').replace(/^\/+|\/+$/g, '');
    return !!prefix && path.replace(/\/+$/, '') === `/${prefix}`;
}
