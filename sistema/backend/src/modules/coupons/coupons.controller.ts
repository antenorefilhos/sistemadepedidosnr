import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CouponsService } from './coupons.service'
import { PricingService } from '../pricing/pricing.service'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'

@ApiTags('Coupons')
@RelaxedThrottle()
@Controller('coupons')
export class CouponsController {
  constructor(
    private readonly couponsService: CouponsService,
    private readonly pricingService: PricingService,
  ) {}

  @Get(':code/availability')
  @ApiOperation({
    summary: 'Quantos usos restam de um cupom (contador de escassez pro storefront)',
    description: 'Publico de proposito -- usado na home/banner antes do cliente logar. So expoe quantidade, nada do resto do cupom.',
  })
  async availability(@Param('code') code: string) {
    return this.pricingService.getCouponAvailability(code)
  }

  @Get('validate')
  @ApiOperation({
    summary: 'Validar cupom',
    description: 'Valida um cupom para o subtotal informado e retorna o desconto calculado.',
  })
  @ApiQuery({ name: 'code', required: true, type: String, description: 'Codigo do cupom' })
  @ApiQuery({ name: 'subtotal', required: true, type: Number, description: 'Subtotal do carrinho' })
  @ApiResponse({ status: 200, description: 'Resultado da validacao do cupom' })
  async validate(@Query('code') code: string, @Query('subtotal') subtotal: string) {
    return this.couponsService.validateCoupon(code, Number(subtotal || 0))
  }

  @Post('validate')
  @ApiOperation({
    summary: 'Validar cupom',
    description: 'Valida um cupom por POST para o subtotal informado e retorna o desconto calculado.',
  })
  @ApiResponse({ status: 200, description: 'Resultado da validacao do cupom' })
  async validatePost(@Body() body: { code: string; subtotal: number; customerId?: string }) {
    return this.couponsService.validateCoupon(body.code, Number(body.subtotal || 0), body.customerId)
  }
}
