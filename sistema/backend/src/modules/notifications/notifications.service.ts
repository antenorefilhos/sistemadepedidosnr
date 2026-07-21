import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { PushNotificationService } from './push-notification.service'

export interface CreateNotificationDto {
  type: 'ORDER_UPDATE' | 'PROMO' | 'CAMPAIGN'
  title: string
  body: string
  customerId?: string
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        type: dto.type,
        title: dto.title,
        body: dto.body,
        customerId: dto.customerId,
      },
    })

    if (notification.customerId) {
      await this.pushNotificationService.sendNotification(notification.customerId, {
        title: notification.title,
        body: notification.body,
        url: '/',
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
}
