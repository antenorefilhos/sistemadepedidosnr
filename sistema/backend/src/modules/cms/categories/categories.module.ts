import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { PrismaService } from '../../../common/prisma.service';

@Module({
  providers: [CategoriesService, PrismaService],
  controllers: [CategoriesController]
})
export class CategoriesModule {}
