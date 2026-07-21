import { Module } from '@nestjs/common'
import { ProductsService } from './products.service'
import { ProductsController } from './products.controller'
import { AdminProductsController } from './admin-products.controller'
import { PrismaService } from '../../common/prisma.service'
import { IntegrationsModule } from '../../modules/integrations/integrations.module'
import { ProductSearchService } from './product-search.service'
import { ProductsSyncScheduler } from './products-sync.scheduler'
import { CategoriesModule } from '../categories/categories.module'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { PermissionGuard } from '../../common/guards/permission.guard'

@Module({
  imports: [IntegrationsModule, CategoriesModule],
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService, PrismaService, ProductSearchService, ProductsSyncScheduler, TenantAccessGuard, PermissionGuard],
  exports: [ProductsService, ProductSearchService],
})
export class ProductsModule {}
