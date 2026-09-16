import { Module } from '@nestjs/common'
import { CategoriesController } from './categories.controller'
import { AdminCategoriesController } from './admin-categories.controller'
import { CategoryHierarchyService } from './category-hierarchy.service'

@Module({
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoryHierarchyService],
  exports: [CategoryHierarchyService]
})
export class CategoriesModule {}


