import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { NotificationsService } from './notifications.service'
import { NotificationService } from './notification.service'
import { AiNotificationService } from './ai-notification.service'
import { IntegrationModulesService } from '../integrations/integration-modules.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'

@ApiTags('Notifications')
@RelaxedThrottle()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationService: NotificationService,
    private readonly aiNotificationService: AiNotificationService,
    private readonly integrationModules: IntegrationModulesService,
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
    @Req() req: { user?: { id?: string; role?: string } },
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
    // Confere o papel: sem isso, um token de funcionario gravava o id de
    // Admin na coluna customerId -- id valido, tabela errada, e a inscricao
    // nunca receberia nada. Funcionario usa push-subscribe/staff.
    if (req.user?.role !== 'customer') {
      throw new UnauthorizedException('Rota de cliente. Equipe usa /notifications/push-subscribe/staff.')
    }
    return this.notificationsService.savePushSubscription(customerId, body)
  }

  @Post('push-subscribe/staff')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Registrar aparelho de funcionario para Web Push',
    description:
      'Usado pelos apps de separacao e entrega, que rodam no celular do funcionario. ' +
      'O destinatario dos avisos e decidido no disparo pelo moduleAccess da conta.',
  })
  async saveStaffPushSubscription(
    @Req() req: { user?: { id?: string; role?: string } },
    @Body()
    body: {
      endpoint: string
      auth?: string
      p256dh?: string
      keys?: { auth?: string; p256dh?: string }
    },
  ) {
    const adminId = String(req.user?.id || '')
    if (!adminId) throw new UnauthorizedException('Não autenticado')
    if (req.user?.role === 'customer') {
      throw new UnauthorizedException('Rota de equipe. Cliente usa /notifications/push-subscribe.')
    }
    // JON-31: achado na varredura de 09/09/2026 -- sem `endpoint` o insert
    // estourava 500 (coluna NOT NULL) em vez de 400.
    if (!body?.endpoint) throw new BadRequestException('Campo "endpoint" é obrigatório.')
    await this.notificationsService.saveStaffPushSubscription(adminId, body)
    return { ok: true }
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
      imageUrl?: string
      productId?: string
      /** Replica o destino do banner: o clique abre onde o botao dele abriria. */
      bannerId?: string
      /** Segmentacao (JON-2): ignorada quando customerId vier preenchido. */
      inactiveDays?: number
      purchasedCategory?: string
      /** ISO datetime opcional: no futuro, agenda em vez de mandar na hora. */
      sendAt?: string
    },
  ) {
    const sendAt = body.sendAt ? new Date(body.sendAt) : undefined
    if (sendAt && !isNaN(sendAt.getTime()) && sendAt.getTime() > Date.now()) {
      const scheduled = await this.notificationsService.scheduleBroadcast({
        type: body.type,
        title: body.title,
        body: body.body,
        customerId: body.customerId,
        imageUrl: body.imageUrl,
        productId: body.productId,
        bannerId: body.bannerId,
        inactiveDays: body.inactiveDays,
        purchasedCategory: body.purchasedCategory,
        sendAt,
      })
      return { scheduled: true, sendAt: scheduled.sendAt }
    }

    const customers = body.customerId
      ? [body.customerId]
      : await this.notificationsService.findCustomerIdsBySegment({
          inactiveDays: body.inactiveDays,
          purchasedCategory: body.purchasedCategory,
        })

    return this.notificationsService.broadcastToCustomers(customers, {
      type: body.type,
      title: body.title,
      body: body.body,
      imageUrl: body.imageUrl,
      productId: body.productId,
      bannerId: body.bannerId,
    })
  }

  @Get('admin/broadcast/scheduled')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Broadcasts agendados, ainda nao disparados' })
  async listScheduledBroadcasts() {
    return this.notificationsService.listScheduledBroadcasts()
  }

  @Post('admin/broadcast/scheduled/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancela um broadcast agendado antes de disparar' })
  async cancelScheduledBroadcast(@Param('id') id: string) {
    return this.notificationsService.cancelScheduledBroadcast(id)
  }

  @Get('admin/broadcast/segment-count')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quantos clientes o filtro de segmentacao do broadcast bateria' })
  async broadcastSegmentCount(
    @Query('inactiveDays') inactiveDays?: string,
    @Query('purchasedCategory') purchasedCategory?: string,
  ) {
    const ids = await this.notificationsService.findCustomerIdsBySegment({
      inactiveDays: inactiveDays ? Number(inactiveDays) : undefined,
      purchasedCategory: purchasedCategory || undefined,
    })
    return { count: ids.length }
  }

  @Get('admin/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Historico de disparos, pra auditoria (o que foi enviado, quando, alcance e leituras)' })
  async listDispatches(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    // "type" aceita um ou varios, separados por virgula (ex: "PROMO,CAMPAIGN").
    // Sem nada, o default e so PROMO+CAMPAIGN -- ORDER_UPDATE (um por mudanca
    // de status de pedido, MUITOS) fica de fora por padrao, ou afoga a
    // auditoria de campanha assim que a loja tiver volume real de pedidos.
    // "ALL" pede tudo, sem filtro.
    @Query('type') type?: string,
  ) {
    const types = !type
      ? ['PROMO', 'CAMPAIGN']
      : type === 'ALL'
        ? undefined
        : type.split(',').map((t) => t.trim()).filter(Boolean)
    return this.notificationsService.listDispatches(limit ? Number(limit) : 50, types, offset ? Number(offset) : 0)
  }

  @Get('admin/history/counts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quantidade de notificacoes por tipo, pra tabs com numero' })
  async countDispatches() {
    return this.notificationsService.countDispatchesByType()
  }

  @Get('admin/ai-cycle/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Le se a notificacao automatica por IA esta ligada' })
  async getAiNotificationStatus() {
    return { enabled: await this.integrationModules.isEnabled('ai-notifications') }
  }

  @Post('admin/ai-cycle/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Liga/desliga a notificacao automatica por IA' })
  async toggleAiNotification(@Body() body: { enabled: boolean }) {
    return this.integrationModules.setEnabled('ai-notifications', Boolean(body?.enabled))
  }

  @Post('admin/ai-cycle/run')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Roda manualmente um ciclo de notificacao automatica por IA (para teste/disparo avulso)' })
  async runAiNotificationCycle() {
    return this.aiNotificationService.runCycle()
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


