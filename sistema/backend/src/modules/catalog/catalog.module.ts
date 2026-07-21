import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { ProductsModule } from '../products/products.module'
import { CatalogCategoriesController, CatalogController, CatalogSearchController } from './catalog.controller'
import { CatalogService } from './catalog.service'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { PermissionGuard } from '../../common/guards/permission.guard'

@Module({
  imports: [ProductsModule],
  controllers: [CatalogController, CatalogCategoriesController, CatalogSearchController],
  providers: [CatalogService, PrismaService, TenantAccessGuard, PermissionGuard],
  exports: [CatalogService],
})
export class CatalogModule {}
