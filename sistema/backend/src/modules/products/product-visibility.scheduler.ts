import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ProductsService } from './products.service'

/**
 * Reverte sozinho o "Ocultar até" vencido (16/10/2026) -- ver
 * `ProductsService.expireHiddenUntil`. Roda independente do sync do ERP:
 * um produto escondido manualmente pode nunca aparecer no sync incremental
 * (ele só traz o que o ERP mudou), então não dá pra confiar nele pra isto.
 */
@Injectable()
export class ProductVisibilityScheduler {
  private readonly logger = new Logger(ProductVisibilityScheduler.name)
  private isRunning = false

  constructor(private readonly productsService: ProductsService) {}

  @Cron('*/15 * * * *', { name: 'product-visibility-expiry' })
  async handleExpiry(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true
    try {
      const { reverted } = await this.productsService.expireHiddenUntil()
      if (reverted > 0) {
        this.logger.log(`"Ocultar até" vencido: ${reverted} produto(s) voltaram a seguir o ERP automaticamente.`)
      }
    } catch (error) {
      this.logger.error('Falha ao expirar "Ocultar até":', error instanceof Error ? error.stack : String(error))
    } finally {
      this.isRunning = false
    }
  }
}
