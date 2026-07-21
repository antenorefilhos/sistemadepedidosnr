import { Module } from '@nestjs/common';
import { PromoBannersService } from './promo-banners.service';
import { PromoBannersController } from './promo-banners.controller';
import { PrismaService } from '../../../common/prisma.service';

@Module({
  controllers: [PromoBannersController],
  providers: [PromoBannersService, PrismaService],
})
export class PromoBannersModule {}
