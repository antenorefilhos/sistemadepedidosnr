import { Module } from '@nestjs/common';
import { HeroSlidesService } from './hero-slides.service';
import { HeroSlidesController } from './hero-slides.controller';
import { PrismaService } from '../../../common/prisma.service';

@Module({
  providers: [HeroSlidesService, PrismaService],
  controllers: [HeroSlidesController]
})
export class HeroSlidesModule {}
