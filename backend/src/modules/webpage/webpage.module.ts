import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { getJWTConfig } from '@common/config/jwt/jwt.config';

import { SpofyCheckoutController, SpofyCheckoutService, SpofyService } from '@modules/spofy';

import { WebpageController } from './webpage.controller';
import { WebpageService } from './webpage.service';

@Module({
    imports: [JwtModule.registerAsync(getJWTConfig())],
    controllers: [WebpageController, SpofyCheckoutController],
    providers: [WebpageService, SpofyService, SpofyCheckoutService],
    exports: [WebpageService],
})
export class WebpageModule {}
