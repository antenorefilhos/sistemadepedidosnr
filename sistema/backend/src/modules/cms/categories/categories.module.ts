import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { HomeVitrinesService } from './home-vitrines.service';
import { CategoriesController } from './categories.controller';
import { PrismaService } from '../../../common/prisma.service';
import { IntegrationsModule } from '../../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule],
  providers: [CategoriesService, HomeVitrinesService, PrismaService],
  controllers: [CategoriesController]
})
export class CategoriesModule {}
