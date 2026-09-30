import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { IntelligenceService } from './intelligence.service'

@ApiTags('Admin Painel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@RelaxedThrottle()
@Controller('admin/intelligence')
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Get()
  @ApiOperation({ summary: 'Funil, busca, produtos, horarios e clientes do periodo' })
  get(@Query('days') days?: string) {
    return this.intelligence.overview(Number(days) || 30)
  }

  @Get('home-shelves')
  @ApiOperation({ summary: 'Por vitrine da pagina inicial: produtos postos no carrinho e quantos viraram pedido' })
  homeShelves(@Query('days') days?: string) {
    return this.intelligence.homeShelves(Math.min(90, Math.max(1, Number(days) || 30)))
  }
}
