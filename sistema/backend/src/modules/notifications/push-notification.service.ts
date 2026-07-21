import { Injectable, Logger } from '@nestjs/common'
import { PushSubscription } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'

type WebPush = {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void
  sendNotification: (
    subscription: { endpoint: string; keys: { auth: string; p256dh: string } },
    payload: string,
  ) => Promise<unknown>
}

const webpush = require('web-push') as WebPush

interface PushNotification {
  title: string
  body: string
  icon?: string
  url?: string
}

interface BrowserPushSubscriptionPayload {
  endpoint: string
  keys?: {
    auth?: string
    p256dh?: string
  }
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name)
  private readonly vapidPublicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim()
  private readonly vapidPrivateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim()
  private readonly vapidSubject = String(process.env.VAPID_SUBJECT || 'mailto:admin@antenor.com.br').trim()
  private readonly enabled = Boolean(this.vapidPublicKey && this.vapidPrivateKey)

  constructor(private prisma: PrismaService) {
    if (this.enabled) {
      webpush.setVapidDetails(this.vapidSubject, this.vapidPublicKey, this.vapidPrivateKey)
      this.logger.log('Web Push habilitado com VAPID.')
    } else {
      this.logger.warn('Web Push sem VAPID configurado; notificacoes push reais ficam desativadas.')
    }
  }

  /**
   * Registra subscription para push notifications
   */
  async registerSubscription(
    customerId: string,
    subscription: BrowserPushSubscriptionPayload,
  ): Promise<void> {
    try {
      await this.prisma.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        update: {
          customerId,
          auth: subscription.keys?.auth || '',
          p256dh: subscription.keys?.p256dh || '',
        },
        create: {
          customerId,
          endpoint: subscription.endpoint,
          auth: subscription.keys?.auth || '',
          p256dh: subscription.keys?.p256dh || '',
        },
      })
    } catch (error) {
      this.logger.error('Erro ao registrar push subscription:', error)
    }
  }

  async removeSubscription(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } })
  }

  async sendNotification(customerId: string, notification: PushNotification): Promise<{ sent: number; failed: number; skipped: number }> {
    if (!this.enabled) {
      this.logger.warn('Web Push ignorado: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY nao configurados.')
      return { sent: 0, failed: 0, skipped: 1 }
    }

    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { customerId },
      })

      let sent = 0
      let failed = 0
      for (const subscription of subscriptions) {
        const ok = await this.sendPushToSubscription(subscription, notification)
        if (ok) sent += 1
        else failed += 1
      }

      return { sent, failed, skipped: 0 }
    } catch (error) {
      this.logger.error('Erro ao enviar push notification:', error)
      return { sent: 0, failed: 1, skipped: 0 }
    }
  }

  async sendNotificationToMany(customerIds: string[], notification: PushNotification) {
    const totals = { sent: 0, failed: 0, skipped: 0 }
    for (const customerId of customerIds) {
      const result = await this.sendNotification(customerId, notification)
      totals.sent += result.sent
      totals.failed += result.failed
      totals.skipped += result.skipped
    }
    return totals
  }

  private async sendPushToSubscription(
    subscription: PushSubscription,
    notification: PushNotification,
  ): Promise<boolean> {
    try {
      if (!subscription.endpoint || !subscription.auth || !subscription.p256dh) {
        this.logger.warn(`Push subscription incompleta removida: ${subscription.id}`)
        await this.removeSubscription(subscription.endpoint)
        return false
      }

      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh,
          },
        },
        JSON.stringify({
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/branding/logo-branco.png',
          url: notification.url || '/',
        }),
      )

      this.logger.debug(`Push enviado para ${subscription.customerId}`)
      return true
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number })?.statusCode || 0)
      if (statusCode === 404 || statusCode === 410) {
        await this.removeSubscription(subscription.endpoint)
        this.logger.warn(`Push subscription expirada removida: ${subscription.id}`)
        return false
      }

      this.logger.error('Erro ao enviar push:', error)
      return false
    }
  }

  /**
   * Envia notificação de novo pedido
   */
  async notifyNewOrder(customerId: string, orderId: string): Promise<void> {
    await this.sendNotification(customerId, {
      title: '🎉 Pedido Confirmado!',
      body: `Seu pedido #${orderId} foi confirmado!`,
      icon: '/logo.png',
    })
  }

  /**
   * Envia notificação de mudança de status
   */
  async notifyStatusChange(
    customerId: string,
    orderId: string,
    status: string,
  ): Promise<void> {
    const messages: Record<string, string> = {
      PENDING: `Pedido #${orderId} recebido`,
      SEPARATING: `Pedido #${orderId} em separação`,
      DELIVERING: `Pedido #${orderId} saiu para entrega`,
      DELIVERED: `Pedido #${orderId} entregue com sucesso!`,
    }

    await this.sendNotification(customerId, {
      title: '📦 Atualização de Pedido',
      body: messages[status] || `Status: ${status}`,
      icon: '/logo.png',
    })
  }
}
