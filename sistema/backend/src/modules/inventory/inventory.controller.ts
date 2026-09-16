import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { InventoryService } from './inventory.service'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'

@RelaxedThrottle()
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getAvailability(
    @Query('productIds') productIds?: string,
    @Query('storeId') storeId?: string,
    @Req() req?: TenantContextRequest,
  ) {
    const context = req ? getTenantContext(req) : undefined
    return this.inventoryService.getAvailability(
      context ? { ...context, ...(storeId ? { storeId } : {}) } : undefined,
      String(productIds || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    )
  }
}

// JON-151 (Auditoria 360, Medium): createReservation nao tinha guard nenhum,
// recebia objeto sem DTO (cartId opcional, ttlMinutes sem teto) e nenhum
// frontend chama essa rota -- o checkout real reserva por dentro
// (OrdersService -> InventoryService.reserveForCheckout, chamada de servico
// direta, nunca por aqui). Restrita a admin, igual ao /release ao lado, em
// vez de mantida aberta sem checagem nenhuma pra um caminho morto.
@RelaxedThrottle()
@Controller('stock/reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class StockReservationsController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  async createReservation(
    @Body() body: { items: Array<{ productId: string; quantity: number }>; cartId?: string; ttlMinutes?: number },
    @Req() req?: TenantContextRequest,
  ) {
    const context = req ? getTenantContext(req) : undefined
    // Mesmo com admin exigido, mantem os limites sugeridos: lote/TTL sem
    // teto continuam ruins mesmo vindos de uma conta confiavel.
    const MAX_ITEMS = 200
    const MAX_TTL_MINUTES = 24 * 60
    const items = (body.items || []).slice(0, MAX_ITEMS)
    const ttlMinutes = body.ttlMinutes != null ? Math.max(1, Math.min(Number(body.ttlMinutes) || 1, MAX_TTL_MINUTES)) : undefined
    return this.inventoryService.reserveForCheckout({
      tenantId: context?.tenantId,
      storeId: context?.storeId,
      cartId: body.cartId,
      items,
      ttlMinutes,
    })
  }

  @Post(':id/release')
  async releaseReservation(@Param('id') id: string) {
    return this.inventoryService.releaseReservation(id, 'Reserva liberada por API')
  }
}

@RelaxedThrottle()
@Controller('admin/stock')
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
@Roles('admin')
export class AdminStockController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('adjustments')
  @RequirePermission('inventory.write')
  @UseGuards(PermissionGuard)
  async createAdjustment(
    @Body() body: { productId: string; quantity: number; reason: string },
    @Req() req?: TenantContextRequest,
  ) {
    return this.inventoryService.createManualAdjustment(req ? getTenantContext(req) : undefined, body, req?.user?.id)
  }

  @Post('picking-ruptures')
  @RequirePermission('picking.write')
  @UseGuards(PermissionGuard)
  async recordPickingRupture(
    @Body() body: { orderId: string; productId: string; missingQuantity: number; reason: string },
    @Req() req?: TenantContextRequest,
  ) {
    return this.inventoryService.recordPickingRupture(req ? getTenantContext(req) : undefined, body, req?.user?.id)
  }

  @Get('negative')
  @RequirePermission('inventory.read')
  @UseGuards(PermissionGuard)
  async getNegative(@Req() req?: TenantContextRequest) {
    return this.inventoryService.listNegativeStock(req ? getTenantContext(req) : undefined)
  }

  @Get('reconciliation')
  @RequirePermission('inventory.read')
  @UseGuards(PermissionGuard)
  async getReconciliation(@Req() req?: TenantContextRequest) {
    return this.inventoryService.createReconciliationReport(req ? getTenantContext(req) : undefined, req?.user?.id)
  }

  @Post('jobs/sync-from-erp')
  @RequirePermission('inventory.write')
  @UseGuards(PermissionGuard)
  async syncFromErp(@Req() req?: TenantContextRequest) {
    return this.inventoryService.syncFromErp(req ? getTenantContext(req) : undefined)
  }

  @Post('jobs/recalculate-available')
  @RequirePermission('inventory.write')
  @UseGuards(PermissionGuard)
  async recalculateAvailable(@Req() req?: TenantContextRequest) {
    return this.inventoryService.recalculateAvailable(req ? getTenantContext(req) : undefined)
  }

  @Post('jobs/expire-reservations')
  @RequirePermission('inventory.write')
  @UseGuards(PermissionGuard)
  async expireReservations() {
    return this.inventoryService.expireReservations()
  }
}
