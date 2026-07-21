import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Roles } from '../../common/decorators/roles.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { CartService } from './cart.service'
import { CheckoutService } from './checkout.service'
import { ConfirmCheckoutSessionDto, CreateCheckoutSessionDto, QuoteCheckoutSessionDto } from './dto/checkout.dto'

@Controller('checkout/sessions')
export class CheckoutSessionsController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @Throttle({ checkout: { limit: 30, ttl: 60000 } })
  async create(@Body() dto: CreateCheckoutSessionDto, @Req() req?: TenantContextRequest) {
    return this.checkoutService.createSession(req ? getTenantContext(req) : undefined, dto)
  }

  @Post(':id/quote')
  @Throttle({ checkout: { limit: 60, ttl: 60000 } })
  async quote(@Param('id') id: string, @Body() dto: QuoteCheckoutSessionDto, @Req() req?: TenantContextRequest) {
    return this.checkoutService.quoteSession(req ? getTenantContext(req) : undefined, id, dto)
  }

  @Post(':id/confirm')
  @Throttle({ checkout: { limit: 20, ttl: 60000 } })
  async confirm(@Param('id') id: string, @Body() dto: ConfirmCheckoutSessionDto, @Req() req?: TenantContextRequest) {
    const clientIp =
      (req?.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req?.ip ||
      undefined
    return this.checkoutService.confirmSession(req ? getTenantContext(req) : undefined, id, { ...dto, clientIp })
  }

  @Post(':id/cancel')
  @Throttle({ checkout: { limit: 30, ttl: 60000 } })
  async cancel(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req?: TenantContextRequest) {
    return this.checkoutService.cancelSession(req ? getTenantContext(req) : undefined, id, body?.reason)
  }
}

@Controller('admin/checkout')
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
@Roles('admin')
export class AdminCheckoutController {
  constructor(private readonly cartService: CartService) {}

  @Post('jobs/abandon-carts')
  async abandonCarts(@Body() body: { olderThanMinutes?: number }, @Req() req?: TenantContextRequest) {
    return this.cartService.markAbandonedCarts(req ? getTenantContext(req) : undefined, body?.olderThanMinutes || 60)
  }
}
