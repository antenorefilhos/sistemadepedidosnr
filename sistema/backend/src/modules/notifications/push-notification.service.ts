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
  image?: string
  url?: string
  /**
   * Agrupa notificacoes do mesmo assunto: a nova substitui a anterior de mesma
   * tag em vez de empilhar mais um balao. Sem isso, uma campanha com varios
   * produtos enterra o cliente em toasts. Omitido = cai no grupo geral.
   */
  tag?: string
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
  private readonly vapidSubject = String(process.env.VAPID_SUBJECT || 'mailto:admin@antenorefilhos.com.br').trim()
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
          // Zera o outro dono: o mesmo aparelho pode ter sido inscrito como
          // funcionario antes (ver registerStaffSubscription).
          adminId: null,
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

  /**
   * Registra a inscricao de um FUNCIONARIO (separacao/entrega).
   *
   * O `update` zera `customerId` e o inverso vale no registro de cliente: um
   * mesmo aparelho pode ser usado pelo cliente e depois pelo funcionario (o
   * celular do dono da loja e o caso obvio), e o endpoint e o mesmo. Sem
   * zerar o dono anterior, a inscricao ficaria com dois donos e a constraint
   * do banco recusaria -- de proposito, pra nao disparar em duplicidade.
   */
  async registerStaffSubscription(
    adminId: string,
    subscription: BrowserPushSubscriptionPayload,
  ): Promise<void> {
    try {
      await this.prisma.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        update: {
          adminId,
          customerId: null,
          auth: subscription.keys?.auth || '',
          p256dh: subscription.keys?.p256dh || '',
        },
        create: {
          adminId,
          endpoint: subscription.endpoint,
          auth: subscription.keys?.auth || '',
          p256dh: subscription.keys?.p256dh || '',
        },
      })
    } catch (error) {
      this.logger.error('Erro ao registrar push subscription de funcionario:', error)
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

  /**
   * Avisa toda a EQUIPE de um modulo (`picking` ou `delivery`).
   *
   * Manda pra quem tem o modulo e esta ativo, buscando no banco na hora --
   * nao guarda lista de destinatario em lugar nenhum. Tirar o modulo de
   * alguem na tela Equipe para de avisar essa pessoa no proximo disparo, sem
   * mais nada.
   *
   * `role='admin'` entra tambem: e master e enxerga todos os modulos (ver
   * ModuleAccessGuard), entao o dono da loja recebe o mesmo aviso que o
   * separador -- se nao quiser, e so nao ativar o push no aparelho dele.
   */
  async sendNotificationToModule(modulo: 'picking' | 'delivery', notification: PushNotification) {
    if (!this.enabled) {
      this.logger.warn('Web Push ignorado: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY nao configurados.')
      return { sent: 0, failed: 0, skipped: 1 }
    }

    const equipe = await this.prisma.admin.findMany({
      where: { active: true, OR: [{ role: 'admin' }, { moduleAccess: { has: modulo } }] },
      select: { id: true },
    })
    if (equipe.length === 0) return { sent: 0, failed: 0, skipped: 0 }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { adminId: { in: equipe.map((pessoa) => pessoa.id) } },
    })

    let sent = 0
    let failed = 0
    for (const subscription of subscriptions) {
      const ok = await this.sendPushToSubscription(subscription, notification)
      if (ok) sent += 1
      else failed += 1
    }
    return { sent, failed, skipped: 0 }
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
          // Quadrado da marca, nao o logo branco em transparente -- aquele
          // some no balao do Windows/Chrome. Ver o comentario no
          // frontend/public/service-worker.js.
          icon: notification.icon || '/branding/pwa-icon-192.png',
          image: notification.image,
          url: notification.url || '/',
          tag: notification.tag,
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
    const titles: Record<string, string> = {
      PENDING: '⏳ Pedido Recebido',
      CONFIRMED: '✅ Pedido Confirmado',
      PICKING_PENDING: '📋 Na Fila de Separacao',
      PICKING: '🛒 Em Separacao',
      CONFERENCE_PENDING: '🔍 Em Conferencia',
      READY_FOR_CHECKOUT: '💳 No Caixa',
      READY_FOR_DELIVERY: '📦 Pronto para Entrega',
      READY_FOR_PICKUP: '📦 Pronto para Retirada',
      OUT_FOR_DELIVERY: '🚚 Saiu para Entrega',
      DELIVERED: '✅ Entregue',
      COMPLETED: '🎉 Concluido',
      CANCELLED: '⚠️ Cancelado',
      FAILED_DELIVERY: '⚠️ Entrega Falhou',
    }

    const messages: Record<string, string> = {
      PENDING: `Pedido #${orderId} recebido`,
      CONFIRMED: `Pedido #${orderId} confirmado e em preparo`,
      PICKING_PENDING: `Pedido #${orderId} na fila de separacao`,
      PICKING: `Pedido #${orderId} sendo separado`,
      CONFERENCE_PENDING: `Pedido #${orderId} separado, em conferencia`,
      READY_FOR_CHECKOUT: `Pedido #${orderId} no caixa`,
      READY_FOR_DELIVERY: `Pedido #${orderId} pronto para entrega`,
      READY_FOR_PICKUP: `Pedido #${orderId} pronto para retirada na loja`,
      OUT_FOR_DELIVERY: `Pedido #${orderId} saiu para entrega`,
      DELIVERED: `Pedido #${orderId} entregue com sucesso!`,
      COMPLETED: `Pedido #${orderId} concluido!`,
      CANCELLED: `Pedido #${orderId} cancelado`,
      FAILED_DELIVERY: `Nao conseguimos entregar o pedido #${orderId}`,
    }

    if (!messages[status]) return

    await this.sendNotification(customerId, {
      title: titles[status] || '📦 Atualizacao de Pedido',
      body: messages[status],
      icon: '/logo.png',
    })
  }
}
