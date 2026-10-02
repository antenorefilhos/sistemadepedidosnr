import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { NotificationsService } from './notifications.service'
import { NotificationService } from './notification.service'
import { OfferPushService } from './offer-push.service'
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
    private readonly offerPush: OfferPushService,
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

  @Post(':id/opened')
  @ApiOperation({ summary: 'Registra o clique no aviso (?n= na URL do push)' })
  async markOpened(@Param('id') id: string) {
    return this.notificationsService.markOpened(String(id).slice(0, 64))
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar todas as notificações do cliente como lidas' })
  async markAllAsRead(@Req() req: { user?: { id?: string } }) {
    const customerId = String(req.user?.id || '')
    if (!customerId) throw new UnauthorizedException('Nao autenticado')
    return this.notificationsService.markAllAsReadForCustomer(customerId)
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Limpar o sininho do cliente (some da lista, fica no histórico do admin)' })
  async clear(@Req() req: { user?: { id?: string } }) {
    const customerId = String(req.user?.id || '')
    if (!customerId) throw new UnauthorizedException('Nao autenticado')
    return this.notificationsService.clearForCustomer(customerId)
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

  // JON-148 (Auditoria 360): logout precisa desvincular a inscricao de push
  // deste aparelho -- sem isso, a proxima pessoa a entrar no mesmo navegador
  // continuava recebendo push da conta anterior. Delete generico (nao
  // customer/staff separado): so remove se o endpoint pertencer a quem esta
  // chamando, entao serve pros dois papeis com a mesma rota.
  @Delete('push-subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover subscription de push deste aparelho (chamado no logout)' })
  async deletePushSubscription(
    @Req() req: { user?: { id?: string; role?: string } },
    @Body() body: { endpoint?: string },
  ) {
    const userId = String(req.user?.id || '')
    if (!userId) throw new UnauthorizedException('Não autenticado')
    if (!body?.endpoint) throw new BadRequestException('Campo "endpoint" é obrigatório.')
    const owner = req.user?.role === 'customer' ? { customerId: userId } : { adminId: userId }
    return this.notificationsService.deletePushSubscriptionByEndpoint(body.endpoint, owner)
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
    @Req() req: { user?: { tenantId?: string } },
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
      }, String(req.user?.tenantId || 'tenant_default'))
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

  // ---- Avisos automaticos de oferta (algoritmo proprio, 29/09/2026) ----

  @Get('admin/auto-offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configuracao, resultado de 30 dias e pesos aprendidos dos avisos automaticos' })
  async autoOffersOverview() {
    return this.offerPush.overview()
  }

  @Patch('admin/auto-offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  async updateAutoOffers(@Body() body: { enabled?: boolean; minDiscount?: number; maxPerWeek?: number; sendHours?: string }) {
    return this.offerPush.updateSettings(body || {})
  }

  @Get('admin/auto-offers/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Simula: quem receberia qual oferta agora (nao envia nada)' })
  async previewAutoOffers() {
    const { picks, candidates, customers } = await this.offerPush.plan()
    return { candidates, customers, picks }
  }

  @Post('admin/auto-offers/run')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Envia agora o que a simulacao mostra (respeita horario da loja e limites)' })
  async runAutoOffers() {
    return this.offerPush.run({ force: true })
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


