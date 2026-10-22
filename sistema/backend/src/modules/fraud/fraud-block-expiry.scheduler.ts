import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'

/**
 * Expira sozinho o bloqueio automatico de aparelho/rede (21/10/2026) --
 * ver `FraudService.createAutoBlock`. Bloqueio manual (`automatic=false`)
 * nunca tem `expiresAt` e nunca e tocado aqui.
 */
@Injectable()
export class FraudBlockExpiryScheduler {
  private readonly logger = new Logger(FraudBlockExpiryScheduler.name)
  private isRunning = false

  constructor(private readonly prisma: PrismaService) {}

  @Cron('*/15 * * * *', { name: 'fraud-block-expiry' })
  async handleExpiry(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true
    try {
      const { count } = await this.prisma.fraudBlock.deleteMany({ where: { automatic: true, expiresAt: { lt: new Date() } } })
      if (count > 0) this.logger.log(`Bloqueio automático vencido: ${count} liberado(s).`)
    } catch (error) {
      this.logger.error('Falha ao expirar bloqueio automático:', error instanceof Error ? error.stack : String(error))
    } finally {
      this.isRunning = false
    }
  }
}
