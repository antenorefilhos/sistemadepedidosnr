import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { CategoriesController } from './categories.controller'
import { AdminCategoriesController } from './admin-categories.controller'
import { CategoryHierarchyService } from './category-hierarchy.service'

@Module({
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoryHierarchyService, PrismaService],
  exports: [CategoryHierarchyService]
})
export class CategoriesModule {}


