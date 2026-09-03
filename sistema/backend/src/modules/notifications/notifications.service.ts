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
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pedido Recebido',
  CONFIRMED: 'Pedido Confirmado',
  PICKING_PENDING: 'Na Fila de Separacao',
  PICKING: 'Em Separacao',
  CONFERENCE_PENDING: 'Em Conferencia',
  READY_FOR_CHECKOUT: 'No Caixa',
  READY_FOR_DELIVERY: 'Pronto para Entrega',
  READY_FOR_PICKUP: 'Pronto para Retirada',
  OUT_FOR_DELIVERY: 'Saiu para Entrega',
  DELIVERED: 'Entregue',
  COMPLETED: 'Concluido',
  CANCELLED: 'Cancelado',
  FAILED_DELIVERY: 'Entrega Falhou',
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
        url: urlDoBanner || (notification.productId ? `/produto/${notification.productId}` : '/'),
      })
    }

    return notification
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
  async listDispatches(limit = 50, type?: string) {
    // Sem filtro, os avisos de pedido (ORDER_UPDATE, um por mudanca de status)
    // afogam as campanhas -- sao muitos e nao e o que se audita aqui.
    const filtro = type ? Prisma.sql`WHERE type = ${type}` : Prisma.empty
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
      LIMIT ${Math.min(limit, 200)}
    `

    return rows.map((r) => ({
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
    }))
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

      const label = STATUS_LABEL[status]
      if (!label) return

      const shortId = orderId.slice(-8).toUpperCase()

      await this.create({
        type: 'ORDER_UPDATE',
        title: label,
        body: `Pedido #${shortId}: ${label}`,
        customerId: order.customerId,
      })

      if (order.customer?.whatsapp) {
        this.whatsAppService.sendStatusUpdate(order.customer.whatsapp, shortId, status).catch((err) => {
          this.logger.warn(`WhatsApp falhou para pedido ${orderId}: ${err.message}`)
        })
      }

      this.pushNotificationService.notifyStatusChange(order.customerId, shortId, status).catch((err) => {
        this.logger.warn(`Push falhou para pedido ${orderId}: ${err.message}`)
      })
    } catch (err) {
      this.logger.error(`Erro ao notificar status ${status} do pedido ${orderId}:`, err)
    }
  }
}
