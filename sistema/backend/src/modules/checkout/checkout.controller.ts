import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { CartService } from './cart.service'
import { CheckoutService } from './checkout.service'
import { ConfirmCheckoutSessionDto, CreateCheckoutSessionDto, QuoteCheckoutSessionDto } from './dto/checkout.dto'

type RequestUser = { id?: string; role?: string }
type AuthedRequest = TenantContextRequest & { user?: RequestUser }

// JON-132 (Auditoria 360, High): quando ha token de cliente valido, ele
// sempre vence o customerId enviado no corpo -- sem isso um corpo
// adulterado atribuia sessao/pedido a outra conta so citando o id dela.
// Sem token, segue exatamente como sempre foi (guest checkout).
export function withVerifiedCustomerId<T extends { customerId?: string }>(dto: T, req?: AuthedRequest): T {
  const verifiedCustomerId = req?.user?.role === 'customer' ? req.user.id : undefined
  return verifiedCustomerId ? { ...dto, customerId: verifiedCustomerId } : dto
}

@Controller('checkout/sessions')
export class CheckoutSessionsController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ checkout: { limit: 30, ttl: 60000 } })
  async create(@Body() dto: CreateCheckoutSessionDto, @Req() req?: AuthedRequest) {
    return this.checkoutService.createSession(req ? getTenantContext(req) : undefined, withVerifiedCustomerId(dto, req))
  }

  @Post(':id/quote')
  @Throttle({ checkout: { limit: 60, ttl: 60000 } })
  async quote(@Param('id') id: string, @Body() dto: QuoteCheckoutSessionDto, @Req() req?: TenantContextRequest) {
    return this.checkoutService.quoteSession(req ? getTenantContext(req) : undefined, id, dto)
  }

  @Post(':id/confirm')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ checkout: { limit: 20, ttl: 60000 } })
  async confirm(@Param('id') id: string, @Body() dto: ConfirmCheckoutSessionDto, @Req() req?: AuthedRequest) {
    // JON-146 (Auditoria 360): priorizava o X-Forwarded-For CRU do header
    // sobre req.ip -- exatamente invertido. req.ip ja resolve XFF sozinho
    // (Express, com `trust proxy` configurado em main.ts), descartando as
    // entradas mais a esquerda que o cliente pode forjar; usar o header direto
    // deixava qualquer chamador escolher o IP que alimenta o antifraude.
    const clientIp = req?.ip || undefined
    return this.checkoutService.confirmSession(req ? getTenantContext(req) : undefined, id, {
      ...withVerifiedCustomerId(dto, req),
      clientIp,
    })
  }

  @Post(':id/cancel')
  @Throttle({ checkout: { limit: 30, ttl: 60000 } })
  async cancel(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req?: TenantContextRequest) {
    return this.checkoutService.cancelSession(req ? getTenantContext(req) : undefined, id, body?.reason)
  }
}

@Controller('admin/checkout')
@RelaxedThrottle()
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
@Roles('admin')
export class AdminCheckoutController {
  constructor(private readonly cartService: CartService) {}

  @Post('jobs/abandon-carts')
  async abandonCarts(@Body() body: { olderThanMinutes?: number }, @Req() req?: TenantContextRequest) {
    return this.cartService.markAbandonedCarts(req ? getTenantContext(req) : undefined, body?.olderThanMinutes || 60)
  }
}
