import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CouponsService } from './coupons.service'

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

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
