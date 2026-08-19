import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { assertCustomerOwnership } from '../../common/security/customer-ownership'
import { RecommendationsService } from './recommendations.service'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'

@ApiTags('Recommendations')
@RelaxedThrottle()
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('rebuy')
  @ApiOperation({ summary: 'Recompre para cliente recorrente' })
  @ApiQuery({ name: 'customerId', required: true })
  @ApiQuery({ name: 'limit', required: false })
  getRebuy(@Query('customerId') customerId: string, @Query('limit') limit?: string, @Req() req?: TenantContextRequest) {
    assertCustomerOwnership(req?.user, customerId)
    return this.recommendations.getRebuy(customerId, req ? getTenantContext(req) : undefined, Number(limit) || 12)
  }

  @Get('complementary/:productId')
  @ApiOperation({ summary: 'Complementares por cesta' })
  @ApiQuery({ name: 'limit', required: false })
  getComplementary(@Param('productId') productId: string, @Query('limit') limit?: string, @Req() req?: TenantContextRequest) {
    return this.recommendations.getComplementary(productId, req ? getTenantContext(req) : undefined, Number(limit) || 12)
  }

  @Get('substitutes/:productId')
  @ApiOperation({ summary: 'Substitutos inteligentes por categoria, preco e disponibilidade' })
  @ApiQuery({ name: 'limit', required: false })
  getSubstitutes(@Param('productId') productId: string, @Query('limit') limit?: string, @Req() req?: TenantContextRequest) {
    return this.recommendations.getSubstitutes(productId, req ? getTenantContext(req) : undefined, Number(limit) || 8)
  }

  @Get('showcase')
  @ApiOperation({ summary: 'Vitrine por segmento com ranking por margem e disponibilidade' })
  @ApiQuery({ name: 'segmentKey', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getShowcase(@Query('segmentKey') segmentKey?: string, @Query('limit') limit?: string, @Req() req?: TenantContextRequest) {
    return this.recommendations.getShowcase({
      ...(req ? getTenantContext(req) : {}),
      segmentKey,
      limit: Number(limit) || 12,
    })
  }

  @Post('events')
  @ApiOperation({ summary: 'Registrar impressao, clique, carrinho ou compra de recomendacao' })
  recordEvent(@Body() body: any, @Req() req?: TenantContextRequest) {
    return this.recommendations.recordEvent(body, req ? getTenantContext(req) : undefined)
  }

  @Get('operational-insights')
  @ApiOperation({ summary: 'Inteligencia operacional de ruptura, criticos, campanha e conversao' })
  getOperationalInsights(@Req() req?: TenantContextRequest) {
    return this.recommendations.getOperationalInsights(req ? getTenantContext(req) : undefined)
  }
}
