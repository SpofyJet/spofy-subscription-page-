import { Request } from 'express';

import {
    Controller,
    ForbiddenException,
    Get,
    NotFoundException,
    Param,
    Post,
    Req,
    UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { ClientIp } from '@common/decorators/get-ip';

import { ICheckoutBody, SpofyCheckoutService } from './spofy-checkout.service';

const SHORT_UUID = /^[A-Za-z0-9_-]{6,64}$/;
const METHOD = /^[a-z0-9_]{1,40}$/;
const PAYMENT_ID = /^[A-Za-z0-9_.:-]{1,80}$/;
const KINDS = new Set(['devices', 'renew', 'tariff', 'traffic']);

const MAX_BODY_BYTES = 8 * 1024;

/**
 * The upstream headerFilterMiddleware strips content-length / transfer-encoding from
 * every request (they are proxy-hop headers for the raw subscription), so Express's
 * body parser sees "no body". Read this small JSON body ourselves.
 */
async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        return req.body as Record<string, unknown>;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > MAX_BODY_BYTES) throw new UnprocessableEntityException({ code: 'invalid_body' });
        chunks.push(chunk as Buffer);
    }
    try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            throw new Error('not an object');
        return parsed as Record<string, unknown>;
    } catch {
        throw new UnprocessableEntityException({ code: 'invalid_body' });
    }
}

const optInt = (value: unknown, min: number, max: number): null | number => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
        throw new UnprocessableEntityException({ code: 'invalid_body' });
    }
    return value;
};

/**
 * Same-origin API used by the subscription page's checkout sheet. Requires the
 * session cookie the page sets when it is served (like /assets), so only a visitor
 * who opened the subscription page can call it.
 */
@Controller('spofy-api')
export class SpofyCheckoutController {
    constructor(
        private readonly checkout: SpofyCheckoutService,
        private readonly jwtService: JwtService,
    ) {}

    @Get(':shortUuid/offer')
    async getOffer(@Req() req: Request, @Param('shortUuid') shortUuid: string) {
        this.guard(req, shortUuid);
        return this.checkout.offer(shortUuid);
    }

    @Post(':shortUuid/checkout')
    async postCheckout(
        @Req() req: Request,
        @ClientIp() clientIp: string,
        @Param('shortUuid') shortUuid: string,
    ) {
        this.guard(req, shortUuid);
        const raw = await readJsonBody(req);

        const kind = raw?.kind;
        const method = raw?.payment_method;
        const option = raw?.payment_option;
        if (typeof kind !== 'string' || !KINDS.has(kind)) {
            throw new UnprocessableEntityException({ code: 'invalid_body' });
        }
        if (typeof method !== 'string' || !METHOD.test(method)) {
            throw new UnprocessableEntityException({ code: 'invalid_body' });
        }
        if (
            option !== undefined &&
            option !== null &&
            (typeof option !== 'string' || option.length > 64)
        ) {
            throw new UnprocessableEntityException({ code: 'invalid_body' });
        }

        const body: ICheckoutBody = {
            kind: kind as ICheckoutBody['kind'],
            payment_method: method,
            payment_option: (option as null | string | undefined) ?? null,
            period_days: optInt(raw.period_days, 1, 3650),
            devices: optInt(raw.devices, 1, 100),
            traffic_gb: optInt(raw.traffic_gb, 0, 100_000),
            tariff_id: optInt(raw.tariff_id, 1, 1_000_000),
        };
        return this.checkout.checkout(shortUuid, body, clientIp);
    }

    @Get(':shortUuid/payments/:method/:paymentId')
    async getStatus(
        @Req() req: Request,
        @Param('shortUuid') shortUuid: string,
        @Param('method') method: string,
        @Param('paymentId') paymentId: string,
    ) {
        this.guard(req, shortUuid);
        if (!METHOD.test(method) || !PAYMENT_ID.test(paymentId)) throw new NotFoundException();
        return this.checkout.status(shortUuid, method, paymentId);
    }

    private guard(req: Request, shortUuid: string): void {
        if (!SHORT_UUID.test(shortUuid) || !this.checkout.allows(shortUuid))
            throw new NotFoundException();

        const cookie = (req.headers.cookie ?? '')
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith('session='));
        try {
            // decodeURIComponent throws on a malformed cookie: that is «no session», not a 500.
            const token = cookie ? decodeURIComponent(cookie.slice('session='.length)) : '';
            this.jwtService.verify(token);
        } catch {
            throw new ForbiddenException({ code: 'no_session' });
        }
    }
}
