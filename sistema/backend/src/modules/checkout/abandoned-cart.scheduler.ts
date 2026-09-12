import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { winstonLogger } from '../../common/logger'

/**
 * Lembrete de carrinho abandonado: cliente colocou item, sumiu por 2h,
 * leva um push uma unica vez (abandonedNotifiedAt evita repeticao).
 * Estilo copiado de ai-notification.scheduler.ts.
 *
 * winstonLogger, nao o Logger do Nest: main.ts sobe com logger:false, entao
 * Logger do Nest nunca aparece em producao (ver push-notification.service.ts,
 * mesma armadilha corrigida em 12/09/2026).
 */
@Injectable()
export class AbandonedCartScheduler {
  private isRunning = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {
    const enabled = (process.env.ABANDONED_CART_ENABLED ?? 'true') !== 'false'
    winstonLogger.info(enabled ? 'abandoned_cart_scheduler_enabled' : 'abandoned_cart_scheduler_disabled', {
      cron: process.env.ABANDONED_CART_CRON || '*/30 * * * *',
    })
  }

  @Cron(process.env.ABANDONED_CART_CRON || '*/30 * * * *', { name: 'abandoned-cart-cycle' })
  async handleCycle(): Promise<void> {
    if ((process.env.ABANDONED_CART_ENABLED ?? 'true') === 'false') return
    if (this.isRunning) {
      winstonLogger.warn('abandoned_cart_cycle_skipped_still_running')
      return
    }

    this.isRunning = true
    try {
      const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000)
      const carts = await this.prisma.cart.findMany({
        where: {
          status: 'ACTIVE',
          customerId: { not: null },
          abandonedNotifiedAt: null,
          updatedAt: { lt: threshold },
          items: { some: {} },
        },
        include: { items: { orderBy: { createdAt: 'asc' }, take: 1 } },
      })

      for (const cart of carts) {
        if (!cart.customerId) continue
        const firstProductId = cart.items[0]?.productId
        const firstProduct = firstProductId
          ? await this.prisma.product.findUnique({ where: { id: firstProductId }, select: { name: true } })
          : null
        const body = firstProduct?.name
          ? `Você deixou "${firstProduct.name}" no carrinho. Finalize seu pedido!`
          : 'Você deixou itens no carrinho. Finalize seu pedido!'

        try {
          await this.notificationsService.create({
            type: 'CAMPAIGN',
            title: 'Esqueceu algo no carrinho?',
            body,
            customerId: cart.customerId,
            url: '/cart',
          })
          await this.prisma.cart.update({
            where: { id: cart.id },
            data: { abandonedNotifiedAt: new Date() },
          })
        } catch (error) {
          winstonLogger.error('abandoned_cart_notify_failed', { cartId: cart.id, error: error instanceof Error ? { message: error.message, stack: error.stack } : error })
        }
      }
    } finally {
      this.isRunning = false
    }
  }
}
