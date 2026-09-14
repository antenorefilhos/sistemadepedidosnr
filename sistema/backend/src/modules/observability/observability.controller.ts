import { Controller, Get, Header, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { ObservabilityService } from './observability.service'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'

@ApiTags('Observability')
@RelaxedThrottle()
@Controller('observability')
export class ObservabilityController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('metrics')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Metricas SRE operacionais: p95, erros, filas, jobs, webhooks, pagamentos e reservas' })
  async metrics() {
    return this.observabilityService.getOperationalMetrics()
  }

  // JON-147 (Auditoria 360, High): scrape Prometheus estava sem guard nenhum
  // -- qualquer leitor anonimo lia rota/latencia/taxa de erro de todo
  // endpoint. Mesmo guard do endpoint /metrics ao lado; nao ha scraper
  // Prometheus real configurado neste projeto (sem env/infra pra token de
  // scrape dedicado), ficaria so YAGNI.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('metrics/prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Metricas HTTP em formato Prometheus exposition' })
  prometheus() {
    return this.observabilityService.getPrometheusMetrics()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('alerts/check')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Avalia alertas SRE contra metricas atuais' })
  async checkAlerts() {
    return this.observabilityService.checkAlerts()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('status-page')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Status page interna consolidando incidentes operacionais' })
  async statusPage() {
    return this.observabilityService.getStatusPage()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('runbooks')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Runbooks operacionais para incidentes SRE comuns' })
  runbooks() {
    return this.observabilityService.getRunbooks()
  }
}
