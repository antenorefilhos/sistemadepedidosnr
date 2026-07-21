import { Module } from '@nestjs/common';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [BrandController],
  providers: [BrandService, PrismaService],
  exports: [BrandService],
})
export class BrandModule {}
