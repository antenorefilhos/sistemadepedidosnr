import { Module, Controller, Get, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { AuthModule } from './modules/auth/auth.module'
import { ProductsModule } from './modules/products/products.module'
import { CustomersModule } from './modules/customers/customers.module'
import { OrdersModule } from './modules/orders/orders.module'
import { AddressesModule } from './modules/addresses/addresses.module'
import { IntegrationsModule } from './modules/integrations/integrations.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { PrismaService } from './common/prisma.service'
import { UploadsModule } from './modules/uploads/uploads.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CmsModule } from './modules/cms/cms.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { BrandModule } from './modules/brand/brand.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { PickingModule } from './modules/picking/picking.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { CrmModule } from './modules/crm/crm.module';
import { TenantContextMiddleware } from './common/tenant/tenant-context.middleware'
import { RequestContextMiddleware } from './common/observability/request-context.middleware'
import { ObservabilityModule } from './modules/observability/observability.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { DataPrivacyModule } from './modules/data-privacy/data-privacy.module';
import { BusinessModule } from './modules/business/business.module';

@Controller()
class AppController {
  @Get()
  getHello() {
    return {
      message: 'API Antenor & Filhos - Sistema de Pedidos Online',
      version: '1.1.0-alpha',
      status: 'online',
      endpoints: {
        auth: '/auth',
        products: '/products',
        customers: '/customers',
        orders: '/orders',
        addresses: '/addresses'
      }
    }
  }

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 600,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 20,
      },
      {
        name: 'checkout',
        ttl: 60000,
        limit: 30,
      },
      {
        name: 'webhook',
        ttl: 60000,
        limit: 120,
      },
    ]),
    AuthModule,
    ProductsModule,
    CustomersModule,
    OrdersModule,
    AddressesModule,
    IntegrationsModule,
    NotificationsModule,
    UploadsModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    CmsModule,
    AuditLogModule,
    AnalyticsModule,
    CouponsModule,
    RecipesModule,
    BrandModule,
    DeliveryModule,
    CategoriesModule,
    CatalogModule,
    InventoryModule,
    PricingModule,
    CheckoutModule,
    PickingModule,
    PublicApiModule,
    CrmModule,
    ObservabilityModule,
    MarketplaceModule,
    RecommendationsModule,
    DataPrivacyModule,
    BusinessModule,
  ],
  controllers: [AppController],
  providers: [
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware, TenantContextMiddleware).forRoutes('*')
  }
}
