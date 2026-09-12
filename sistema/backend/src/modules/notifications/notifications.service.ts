import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { resolveBannerLink } from '../cms/store-banners/banner-link'
import { PrismaService } from '../../common/prisma.service'
import { PushNotificationService } from './push-notification.service'
import { WhatsAppService } from './whatsapp.service'

export interface CreateNotificationDto {
  type: 'ORDER_UPDATE' | 'PROMO' | 'CAMPAIGN'
  title: string
  body: string
  customerId?: string
  imageUrl?: string
  productId?: string
  /**
   * Aponta a notificacao pra um banner: o clique abre exatamente onde o botao
   * daquele banner abriria (categoria, produto, busca ou URL), porque o destino
   * e resolvido do proprio linkType/linkValue dele. Vence o productId quando os
   * dois vierem.
   */
  bannerId?: string
  /**
   * URL do push, vence banner/produto/fallback quando informada. Nao e
   * persistida (Notification nao tem coluna de url) -- so afeta o push.
   */
  url?: string
}

/**
 * Fonte UNICA de titulo/emoji/corpo por status de pedido.
 *
 * Ate 12/09/2026 existiam DUAS copias manuais disso -- uma aqui (so label,
 * sem emoji, usada no sino) e outra em push-notification.service.ts (com
 * emoji + frase completa, usada so no push). As duas precisavam ser mantidas
 * em sincronia a mao e nunca eram: READY_FOR_CHECKOUT chegou a faltar dos
 * dois lados em momentos diferentes. Pior, os DOIS caminhos eram chamados pra
 * cada mudanca de status (ver notifyOrderStatusChange), entao o cliente
 * recebia dois pushes diferentes pro mesmo evento.
 *
 * Agora e um mapa so, e notifyOrderStatusChange chama create() uma unica vez
 * -- o sino e o push usam exatamente o mesmo titulo/corpo.
 */
const ORDER_STATUS_META: Record<string, { emoji: string; label: string; body: (shortId: string) => string }> = {
  PENDING: { emoji: '⏳', label: 'Pedido Recebido', body: (id) => `Pedido #${id} recebido` },
  CONFIRMED: { emoji: '✅', label: 'Pedido Confirmado', body: (id) => `Pedido #${id} confirmado e em preparo` },
  PICKING_PENDING: { emoji: '📋', label: 'Na Fila de Separação', body: (id) => `Pedido #${id} na fila de separação` },
  PICKING: { emoji: '🛒', label: 'Em Separação', body: (id) => `Pedido #${id} sendo separado` },
  CONFERENCE_PENDING: { emoji: '🔍', label: 'Em Conferência', body: (id) => `Pedido #${id} separado, em conferência` },
  READY_FOR_CHECKOUT: { emoji: '💳', label: 'No Caixa', body: (id) => `Pedido #${id} no caixa` },
  READY_FOR_DELIVERY: { emoji: '📦', label: 'Pronto para Entrega', body: (id) => `Pedido #${id} pronto para entrega` },
  READY_FOR_PICKUP: { emoji: '📦', label: 'Pronto para Retirada', body: (id) => `Pedido #${id} pronto para retirada na loja` },
  OUT_FOR_DELIVERY: { emoji: '🚚', label: 'Saiu para Entrega', body: (id) => `Pedido #${id} saiu para entrega` },
  DELIVERED: { emoji: '✅', label: 'Entregue', body: (id) => `Pedido #${id} entregue com sucesso!` },
  COMPLETED: { emoji: '🎉', label: 'Concluído', body: (id) => `Pedido #${id} concluído!` },
  CANCELLED: { emoji: '⚠️', label: 'Cancelado', body: (id) => `Pedido #${id} cancelado` },
  FAILED_DELIVERY: { emoji: '⚠️', label: 'Entrega Falhou', body: (id) => `Não conseguimos entregar o pedido #${id}` },
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async create(dto: CreateNotificationDto) {
    // Destino do banner resolvido AQUI, no envio, e nao no clique: o push
    // carrega uma URL pronta, e a regra de resolucao e a mesma do storefront
    // (ver banner-link.ts e o teste de paridade que guarda as duas copias).
    let urlDoBanner: string | undefined
    if (dto.bannerId) {
      const banner = await this.prisma.storeBanner.findUnique({
        where: { id: dto.bannerId },
        select: { linkType: true, linkValue: true, desktopImageUrl: true },
      })
      if (!banner) throw new NotFoundException('Banner nao encontrado')
      urlDoBanner = resolveBannerLink(banner.linkValue, banner.linkType)
      // Sem imagem escolhida, usa a arte do proprio banner -- e o que o cliente
      // ja viu na loja, entao a notificacao fica coerente com a campanha. Usa a
      // versao desktop: e a unica obrigatoria no schema (mobileImageUrl e
      // opcional) e o balao da notificacao e largo, nao estreito.
      if (!dto.imageUrl) dto.imageUrl = banner.desktopImageUrl || undefined
    }

    const notification = await this.prisma.notification.create({
      data: {
        type: dto.type,
        title: dto.title,
        body: dto.body,
        customerId: dto.customerId,
        imageUrl: dto.imageUrl,
        productId: dto.productId,
      },
    })

    if (notification.customerId) {
      await this.pushNotificationService.sendNotification(notification.customerId, {
        title: notification.title,
        body: notification.body,
        image: notification.imageUrl || undefined,
        url: dto.url || urlDoBanner || (notification.productId ? `/produto/${notification.productId}` : '/'),
      })
    }

    return notification
  }

  /**
   * Broadcast pra varios clientes de uma vez (admin/broadcast, ciclo de IA).
   *
   * Ate 12/09/2026 o controller fazia um loop `for` chamando create() uma vez
   * por cliente: cada iteracao refazia a MESMA consulta do banner (se houver)
   * e mandava os pushes um de cada vez, em serie. Pra loja pequena nao doia,
   * mas escala mal -- resolve o banner UMA vez aqui e manda os pushes em
   * paralelo.
   */
  async broadcastToCustomers(customerIds: string[], dto: Omit<CreateNotificationDto, 'customerId'>) {
    if (customerIds.length === 0) return { count: 0 }

    let urlDoBanner: string | undefined
    let imageUrl = dto.imageUrl
    if (dto.bannerId) {
      const banner = await this.prisma.storeBanner.findUnique({
        where: { id: dto.bannerId },
        select: { linkType: true, linkValue: true, desktopImageUrl: true },
      })
      if (!banner) throw new NotFoundException('Banner nao encontrado')
      urlDoBanner = resolveBannerLink(banner.linkValue, banner.linkType)
      if (!imageUrl) imageUrl = banner.desktopImageUrl || undefined
    }

    await this.prisma.notification.createMany({
      data: customerIds.map((customerId) => ({
        type: dto.type,
        title: dto.title,
        body: dto.body,
        customerId,
        imageUrl,
        productId: dto.productId,
      })),
    })

    const url = urlDoBanner || (dto.productId ? `/produto/${dto.productId}` : '/')
    await Promise.all(
      customerIds.map((customerId) =>
        this.pushNotificationService.sendNotification(customerId, {
          title: dto.title,
          body: dto.body,
          image: imageUrl,
          url,
        }),
      ),
    )

    return { count: customerIds.length }
  }

  /**
   * Historico de disparos, pra auditoria: o que foi enviado, quando, pra
   * quantos e quantos abriram.
   *
   * Nao existe entidade "disparo" no schema -- cada envio grava uma linha por
   * cliente, soltas. O agrupamento e reconstruido por (titulo, corpo, minuto),
   * que funciona porque as linhas de um mesmo envio nascem no mesmo segundo.
   * Nao e vinculo real: dois envios identicos dentro do mesmo minuto contariam
   * como um. Na pratica isso nao acontece (o ciclo da IA tem cooldown de 20h
   * por produto), e a alternativa exigiria migration com batchId. Se um dia
   * precisar de precisao -- relatorio por campanha pra anunciante, por
   * exemplo -- e ai que vale criar a coluna.
   */
  /**
   * `types` filtra quais tipos entram (PROMO/CAMPAIGN/ORDER_UPDATE). Quem
   * decide o default e o CONTROLLER, nao aqui -- ver notifications.controller.ts:
   * sem filtro explicito no request, ele manda ['PROMO','CAMPAIGN'], que e o
   * que essa tela audita de verdade. `offset` pagina; `hasMore` vem de pedir
   * um registro a mais do que o limite e checar se sobrou.
   */
  async listDispatches(limit = 50, types?: string[], offset = 0) {
    const filtro = types && types.length > 0 ? Prisma.sql`WHERE type = ANY(${types})` : Prisma.empty
    const limitSeguro = Math.min(Math.max(limit, 1), 200)
    const rows = await this.prisma.$queryRaw<Array<{
      title: string
      body: string
      type: string
      productId: string | null
      imageUrl: string | null
      sentAt: Date
      recipients: bigint
      reads: bigint
    }>>`
      SELECT
        title,
        body,
        MIN(type) AS type,
        MIN("productId") AS "productId",
        MIN("imageUrl") AS "imageUrl",
        MIN("createdAt") AS "sentAt",
        COUNT(*) AS recipients,
        COUNT(*) FILTER (WHERE read) AS reads
      FROM notifications
      ${filtro}
      GROUP BY title, body, date_trunc('minute', "createdAt")
      ORDER BY MIN("createdAt") DESC
      LIMIT ${limitSeguro + 1}
      OFFSET ${Math.max(offset, 0)}
    `

    const hasMore = rows.length > limitSeguro
    const pagina = rows.slice(0, limitSeguro)

    return {
      hasMore,
      items: pagina.map((r) => ({
        title: r.title,
        body: r.body,
        type: r.type,
        productId: r.productId,
        imageUrl: r.imageUrl,
        sentAt: r.sentAt,
        recipients: Number(r.recipients),
        reads: Number(r.reads),
        // Taxa de leitura da notificacao in-app. NAO e taxa de entrega do push:
        // o retorno do envio (sent/failed) nao e persistido hoje, entao ninguem
        // sabe se o aviso chegou no aparelho -- so se foi gravado e lido aqui.
        readRate: Number(r.recipients) > 0 ? Number(r.reads) / Number(r.recipients) : 0,
      })),
    }
  }

  /** Contagem por tipo, pra tabs com numero ("Promoções (182)") sem precisar
   * carregar a lista inteira so pra saber quantas tem. */
  async countDispatchesByType() {
    const rows = await this.prisma.notification.groupBy({ by: ['type'], _count: { _all: true } })
    return Object.fromEntries(rows.map((r) => [r.type, r._count._all]))
  }

  async findByCustomer(customerId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    })
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    })
  }

  async markAsReadForCustomer(notificationId: string, customerId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, customerId },
      data: { read: true },
    })

    if (result.count === 0) {
      throw new NotFoundException('Notificacao nao encontrada')
    }

    return this.prisma.notification.findUnique({ where: { id: notificationId } })
  }

  async countUnread(customerId: string) {
    return this.prisma.notification.count({
      where: { customerId, read: false },
    })
  }

  async savePushSubscription(
    customerId: string,
    subscription: {
      endpoint: string
      auth?: string
      p256dh?: string
      keys?: {
        auth?: string
        p256dh?: string
      }
    },
  ) {
    const auth = subscription.auth || subscription.keys?.auth || ''
    const p256dh = subscription.p256dh || subscription.keys?.p256dh || ''

    return this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      // adminId: null zera dono anterior -- o mesmo aparelho pode ter sido
      // inscrito como funcionario, e a constraint do banco exige UM dono.
      update: { customerId, adminId: null, auth, p256dh },
      create: {
        customerId,
        endpoint: subscription.endpoint,
        auth,
        p256dh,
      },
    })
  }

  /** Inscricao de aparelho de funcionario (apps de separacao e entrega). */
  async saveStaffPushSubscription(
    adminId: string,
    subscription: { endpoint: string; auth?: string; p256dh?: string; keys?: { auth?: string; p256dh?: string } },
  ) {
    const auth = subscription.auth || subscription.keys?.auth || ''
    const p256dh = subscription.p256dh || subscription.keys?.p256dh || ''

    return this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      // customerId: null zera dono anterior -- o celular do dono da loja pode
      // ter sido inscrito como cliente antes, e o banco exige UM dono.
      update: { adminId, customerId: null, auth, p256dh },
      create: { adminId, endpoint: subscription.endpoint, auth, p256dh },
    })
  }

  async getPushSubscriptionsForCustomer(customerId: string) {
    return this.prisma.pushSubscription.findMany({
      where: { customerId },
    })
  }

  async getAllCustomerIds(): Promise<string[]> {
    const customers = await this.prisma.customer.findMany({
      select: { id: true },
    })
    return customers.map((c) => c.id)
  }

  /** Agenda um broadcast pra rodar depois -- ScheduledNotificationScheduler dispara quando sendAt chegar. */
  async scheduleBroadcast(dto: {
    type: 'PROMO' | 'CAMPAIGN'
    title: string
    body: string
    customerId?: string
    imageUrl?: string
    productId?: string
    bannerId?: string
    inactiveDays?: number
    purchasedCategory?: string
    sendAt: Date
  }) {
    return this.prisma.scheduledNotification.create({ data: dto })
  }

  async listScheduledBroadcasts() {
    return this.prisma.scheduledNotification.findMany({
      where: { sentAt: null },
      orderBy: { sendAt: 'asc' },
    })
  }

  async cancelScheduledBroadcast(id: string) {
    const result = await this.prisma.scheduledNotification.deleteMany({ where: { id, sentAt: null } })
    if (result.count === 0) throw new NotFoundException('Agendamento nao encontrado ou ja disparado')
    return { ok: true }
  }

  /** Dispara os agendamentos vencidos -- chamado pelo scheduler a cada poucos minutos. */
  async runDueScheduledBroadcasts() {
    const due = await this.prisma.scheduledNotification.findMany({
      where: { sentAt: null, sendAt: { lte: new Date() } },
    })
    for (const item of due) {
      const customers = item.customerId
        ? [item.customerId]
        : await this.findCustomerIdsBySegment({
            inactiveDays: item.inactiveDays ?? undefined,
            purchasedCategory: item.purchasedCategory ?? undefined,
          })
      await this.broadcastToCustomers(customers, {
        type: item.type as 'PROMO' | 'CAMPAIGN',
        title: item.title,
        body: item.body,
        imageUrl: item.imageUrl ?? undefined,
        productId: item.productId ?? undefined,
        bannerId: item.bannerId ?? undefined,
      })
      await this.prisma.scheduledNotification.update({ where: { id: item.id }, data: { sentAt: new Date() } })
    }
    return { count: due.length }
  }

  /**
   * Segmentacao pro broadcast manual (admin). Sem filtro nenhum, cai no
   * comportamento antigo (todos). Os dois filtros, quando vem juntos, sao
   * intersecao (E, nao OU) -- e o que "inativos ha 30 dias que compraram
   * vinho" espera.
   */
  async findCustomerIdsBySegment(filtro: { inactiveDays?: number; purchasedCategory?: string }): Promise<string[]> {
    if (!filtro.inactiveDays && !filtro.purchasedCategory) {
      return this.getAllCustomerIds()
    }

    let ids: string[] | undefined

    if (filtro.purchasedCategory) {
      const rows = await this.prisma.order.findMany({
        where: { items: { some: { product: { category: filtro.purchasedCategory } } } },
        select: { customerId: true },
        distinct: ['customerId'],
      })
      ids = rows.map((r) => r.customerId)
    }

    if (filtro.inactiveDays) {
      const cutoff = new Date(Date.now() - filtro.inactiveDays * 24 * 60 * 60 * 1000)
      const lastOrderByCustomer = await this.prisma.order.groupBy({
        by: ['customerId'],
        _max: { createdAt: true },
      })
      const recentIds = new Set(
        lastOrderByCustomer.filter((o) => o._max.createdAt && o._max.createdAt >= cutoff).map((o) => o.customerId),
      )
      const allCustomers = await this.prisma.customer.findMany({ select: { id: true } })
      const inactiveIds = allCustomers.map((c) => c.id).filter((id) => !recentIds.has(id))
      ids = ids ? ids.filter((id) => inactiveIds.includes(id)) : inactiveIds
    }

    return ids ?? []
  }

  /**
   * Avisa a equipe de separacao que ha pedido novo pra separar.
   *
   * Existe porque o app de separacao roda no CELULAR do funcionario e ate
   * 03/09/2026 nao avisava nada: so descobria pedido novo quem lembrasse de
   * abrir o app e olhar a lista. Pedido parado e SLA estourado sem ninguem
   * saber -- e o cliente esperando.
   *
   * Nunca deixa uma falha de push derrubar o fluxo: o pedido ja foi criado e
   * a tarefa ja existe quando isto roda. Aviso que nao sai e ruim; pedido que
   * nao entra na fila por causa do aviso e muito pior.
   */
  async notifyPickingTeamNewOrder(orderId: string, itemCount: number): Promise<void> {
    const shortId = orderId.slice(-8).toUpperCase()
    try {
      await this.pushNotificationService.sendNotificationToModule('picking', {
        title: 'Novo pedido para separar',
        body: `Pedido #${shortId} - ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`,
        url: `/pedidos/${orderId}`,
        // Uma notificacao por pedido: sem tag, dez pedidos viram dez avisos
        // empilhados e o separador para de ler.
        tag: `picking-${orderId}`,
      })
    } catch (error) {
      this.logger.warn(`Push de separacao falhou para ${orderId}: ${(error as Error).message}`)
    }
  }

  /**
   * Avisa a equipe de entrega que ha pedido disponivel na fila.
   *
   * Dispara quando o pedido e faturado no PDV e vira READY_FOR_DELIVERY --
   * o momento em que ele aparece na fila compartilhada e qualquer entregador
   * pode pegar pra si.
   */
  async notifyDeliveryTeamOrderReady(orderId: string): Promise<void> {
    const shortId = orderId.slice(-8).toUpperCase()
    try {
      await this.pushNotificationService.sendNotificationToModule('delivery', {
        title: 'Entrega disponivel',
        body: `Pedido #${shortId} liberado para entrega`,
        url: '/',
        tag: `delivery-${orderId}`,
      })
    } catch (error) {
      this.logger.warn(`Push de entrega falhou para ${orderId}: ${(error as Error).message}`)
    }
  }

  async notifyOrderStatusChange(orderId: string, status: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, customerId: true, customer: { select: { id: true, name: true, whatsapp: true } } },
      })
      if (!order?.customerId) return

      const meta = ORDER_STATUS_META[status]
      if (!meta) return

      const shortId = orderId.slice(-8).toUpperCase()

      // Uma chamada so: create() ja manda o push (ver acima). Sino e push
      // usam o MESMO titulo/corpo agora -- nao tem segundo caminho de envio.
      await this.create({
        type: 'ORDER_UPDATE',
        title: `${meta.emoji} ${meta.label}`,
        body: meta.body(shortId),
        customerId: order.customerId,
        url: '/account',
      })

      if (order.customer?.whatsapp) {
        this.whatsAppService.sendStatusUpdate(order.customer.whatsapp, shortId, status).catch((err) => {
          this.logger.warn(`WhatsApp falhou para pedido ${orderId}: ${err.message}`)
        })
      }
    } catch (err) {
      this.logger.error(`Erro ao notificar status ${status} do pedido ${orderId}:`, err)
    }
  }
}
