import { Injectable, Logger, NotFoundException } from '@nestjs/common'
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
        url: notification.productId ? `/produto/${notification.productId}` : '/',
      })
    }

    return notification
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
      update: { customerId, auth, p256dh },
      create: {
        customerId,
        endpoint: subscription.endpoint,
        auth,
        p256dh,
      },
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
