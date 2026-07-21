import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { NotificationsService } from './notifications.service'
import { NotificationService } from './notification.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationService: NotificationService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar notificações do cliente' })
  async findByCustomer(@Req() req: { user?: { id?: string } }) {
    const customerId = String(req.user?.id || '')
    if (!customerId) return []
    return this.notificationsService.findByCustomer(customerId)
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Contar notificações não lidas' })
  async countUnread(@Req() req: { user?: { id?: string } }) {
    const customerId = String(req.user?.id || '')
    if (!customerId) return 0
    return this.notificationsService.countUnread(customerId)
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar notificação como lida' })
  async markAsRead(@Param('id') id: string, @Req() req: { user?: { id?: string } }) {
    const customerId = String(req.user?.id || '')
    if (!customerId) throw new UnauthorizedException('Nao autenticado')
    return this.notificationsService.markAsReadForCustomer(id, customerId)
  }

  @Post('push-subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar subscription para Web Push' })
  async savePushSubscription(
    @Req() req: { user?: { id?: string } },
    @Body()
    body: {
      endpoint: string
      auth?: string
      p256dh?: string
      keys?: {
        auth?: string
        p256dh?: string
      }
    },
  ) {
    const customerId = String(req.user?.id || '')
    if (!customerId) throw new UnauthorizedException('Não autenticado')
    return this.notificationsService.savePushSubscription(customerId, body)
  }

  @Post('admin/broadcast')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Broadcast: enviar notificação para clientes' })
  async broadcastNotification(
    @Body()
    body: {
      type: 'PROMO' | 'CAMPAIGN'
      title: string
      body: string
      customerId?: string // se vazio, para todos
    },
  ) {
    const customers = body.customerId
      ? [body.customerId]
      : await this.notificationsService.getAllCustomerIds()

    const created = []
    for (const customerId of customers) {
      const notification = await this.notificationsService.create({
        type: body.type,
        title: body.title,
        body: body.body,
        customerId,
      })
      created.push(notification)
    }

    return { count: created.length, notifications: created }
  }

  @Post('admin/pending-mappings/notify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gerar notificações para pendências de mapeamento de categoria' })
  async notifyPendingMappings() {
    const result = await this.notificationService.notifyPendingCategoryMappings()
    return { message: result }
  }

  @Get('admin/pending-mappings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar notificações de pendências de mapeamento' })
  async listPendingMappingNotifications(
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ) {
    const { notifications, total, unread } = await this.notificationService.listPendingMappingNotifications(
      parseInt(limit),
      parseInt(offset),
    )
    return { total, unread, notifications }
  }

  @Patch('admin/pending-mappings/:id/read')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar notificação de pendência como lida' })
  async markPendingMappingNotificationAsRead(@Param('id') id: string) {
    const data = await this.notificationService.markOneAsRead(id)
    return { success: true, data }
  }
}


