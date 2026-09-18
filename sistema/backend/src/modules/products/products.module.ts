import { Module, forwardRef } from '@nestjs/common'
import { ProductsService } from './products.service'
import { ProductsController } from './products.controller'
import { AdminProductsController } from './admin-products.controller'
import { IntegrationsModule } from '../../modules/integrations/integrations.module'
import { ProductSearchService } from './product-search.service'
import { ProductsSyncScheduler } from './products-sync.scheduler'
import { MissingProductsMonitor } from './missing-products.monitor'
import { CategoriesModule } from '../categories/categories.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { PermissionGuard } from '../../common/guards/permission.guard'

@Module({
  // JON-33 (Auditoria 360): forwardRef nos dois lados (aqui e em
  // IntegrationsModule) -- o webhook de produto.alterado precisa injetar
  // ProductsService no IntegrationsController, e Products ja importa
  // Integrations (pra AntenorApiService/SolidcomERPService). Sem forwardRef
  // isso e dependencia circular na cara.
  imports: [forwardRef(() => IntegrationsModule), CategoriesModule, NotificationsModule],
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService, ProductSearchService, ProductsSyncScheduler, MissingProductsMonitor, TenantAccessGuard, PermissionGuard],
  exports: [ProductsService, ProductSearchService],
})
export class ProductsModule {}
