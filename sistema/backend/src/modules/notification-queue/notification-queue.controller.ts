import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { NotificationQueueService, type QueueEditInput, type QueueSettingsInput } from './notification-queue.service'

type AdminRequest = { user?: { id?: string } }

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@RelaxedThrottle()
@Controller('notifications/admin/queue')
export class NotificationQueueController {
  constructor(private readonly queue: NotificationQueueService) {}

  @Get()
  @ApiOperation({ summary: 'Fila de envios: o que vai sair (encarte, oferta, agendado) e o que saiu nos ultimos 3 dias' })
  list(@Query('refresh') refresh?: string) {
    return this.queue.list({ refresh: refresh === '1' || refresh === 'true' })
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Liga/desliga cada tipo de envio e se exige aprovacao' })
  settings(@Body() body: QueueSettingsInput) {
    return this.queue.updateSettings(body || {})
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita titulo, texto, destino, imagem e horario de um envio da fila' })
  edit(@Param('id') id: string, @Body() body: QueueEditInput, @Req() req: AdminRequest) {
    return this.queue.edit(id, body || {}, req.user?.id)
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.queue.approve(id, req.user?.id)
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.queue.cancel(id, req.user?.id)
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.queue.restore(id, req.user?.id)
  }

  @Post(':id/send-now')
  @ApiOperation({ summary: 'Manda agora (mesmo com a loja fechada)' })
  sendNow(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.queue.sendNow(id, req.user?.id)
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.queue.retry(id)
  }
}
