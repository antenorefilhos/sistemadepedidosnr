import { Module } from '@nestjs/common';
import { StoreBannersService } from './store-banners.service';
import { StoreBannersController } from './store-banners.controller';
import { PrismaService } from '../../../common/prisma.service';

@Module({
  controllers: [StoreBannersController],
  providers: [StoreBannersService, PrismaService],
  exports: [StoreBannersService],
})
export class StoreBannersModule {}
