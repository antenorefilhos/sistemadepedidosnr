import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { PricingService } from './pricing.service'

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('quote')
  async quote(@Body() body: any, @Req() req?: TenantContextRequest) {
    const context = req ? getTenantContext(req) : undefined
    return this.pricingService.quote({
      tenantId: body.tenantId || context?.tenantId,
      storeId: body.storeId || context?.storeId,
      channel: body.channel,
      customerId: body.customerId,
      customerSegment: body.customerSegment,
      businessAccountId: body.businessAccountId,
      couponCode: body.couponCode,
      deliveryAmount: body.deliveryAmount,
      items: body.items || [],
    })
  }
}

@Controller('admin/price-lists')
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
@Roles('admin')
export class AdminPriceListsController {
  constructor(private readonly pricingService: PricingService) {}

  @Get()
  @RequirePermission('pricing.read')
  @UseGuards(PermissionGuard)
  async list(@Req() req?: TenantContextRequest) {
    return this.pricingService.listPriceLists(req ? getTenantContext(req) : undefined)
  }

  @Post()
  @RequirePermission('pricing.write')
  @UseGuards(PermissionGuard)
  async create(@Body() body: any, @Req() req?: TenantContextRequest) {
    return this.pricingService.createPriceList(req ? getTenantContext(req) : undefined, body, req?.user?.id)
  }

  @Post(':id/items/bulk')
  @RequirePermission('pricing.write')
  @UseGuards(PermissionGuard)
  async bulkItems(@Param('id') id: string, @Body() body: { items: any[] }, @Req() req?: TenantContextRequest) {
    return this.pricingService.bulkUpsertPriceItems(id, body.items || [], req?.user?.id)
  }
}

@Controller('admin/promotions')
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
@Roles('admin')
export class AdminPromotionsController {
  constructor(private readonly pricingService: PricingService) {}

  @Get()
  @RequirePermission('promotions.read')
  @UseGuards(PermissionGuard)
  async list(@Req() req?: TenantContextRequest) {
    return this.pricingService.listPromotions(req ? getTenantContext(req) : undefined)
  }

  @Post()
  @RequirePermission('promotions.write')
  @UseGuards(PermissionGuard)
  async create(@Body() body: any, @Req() req?: TenantContextRequest) {
    return this.pricingService.createPromotion(req ? getTenantContext(req) : undefined, body)
  }

  @Post(':id/simulate')
  @RequirePermission('promotions.read')
  @UseGuards(PermissionGuard)
  async simulate(@Param('id') id: string, @Body() body: any) {
    return this.pricingService.simulatePromotion(id, body || {})
  }
}
