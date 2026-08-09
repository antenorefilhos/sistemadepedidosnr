import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ProductsService } from './products.service'

/**
 * Agenda a sincronização automática do catálogo com o ERP Solidcom.
 *
 * Controlado por variáveis de ambiente:
 * - ERP_SYNC_CRON_ENABLED: 'true' para habilitar (default: desabilitado).
 * - ERP_SYNC_CRON: expressão cron (default: '0 4 * * *' — 04:00 diariamente).
 * - TZ: fuso horário do processo (recomendado 'America/Sao_Paulo').
 *
 * O sync manual (endpoint admin) continua funcionando independentemente.
 * Uma trava em memória evita execuções concorrentes (cron sobrepondo sync manual/anterior).
 */
@Injectable()
export class ProductsSyncScheduler {
  private readonly logger = new Logger(ProductsSyncScheduler.name)
  private readonly enabled = String(process.env.ERP_SYNC_CRON_ENABLED || '').toLowerCase() === 'true'
  private isRunning = false

  constructor(private readonly productsService: ProductsService) {
    if (this.enabled) {
      this.logger.log(
        `Sync automático do ERP HABILITADO (cron: ${process.env.ERP_SYNC_CRON || '0 4 * * *'}).`,
      )
    } else {
      this.logger.log('Sync automático do ERP desabilitado (defina ERP_SYNC_CRON_ENABLED=true para ativar).')
    }
  }

  /**
   * Sync incremental: so o que o ERP mexeu na janela recente.
   *
   * Roda de hora em hora porque custa ~2s contra os ~190s do completo — e o que
   * faz produto novo e promocao nova chegarem rapido na vitrine, em vez de
   * esperarem ate as 04:00. Ver docs/solidcom-api.md.
   *
   * - ERP_SYNC_INCREMENTAL_CRON: expressao cron (default: de hora em hora).
   * - ERP_SYNC_INCREMENTAL_HOURS: tamanho da janela (default: 2h, com folga
   *   proposital sobre o intervalo de 1h para nao perder mudanca na virada).
   */
  @Cron(process.env.ERP_SYNC_INCREMENTAL_CRON || '0 * * * *', {
    name: 'erp-product-sync-incremental',
  })
  async handleIncrementalSync(): Promise<void> {
    if (!this.enabled) return

    if (this.isRunning) {
      this.logger.warn('Sync incremental ignorado: uma sincronizacao ainda esta em andamento.')
      return
    }

    this.isRunning = true
    try {
      const hours = Number(process.env.ERP_SYNC_INCREMENTAL_HOURS || 2)
      const result = await this.productsService.syncRecentFromERP(hours)

      if ((result as { skipped?: boolean }).skipped) return

      const changed = (result as { changed?: number }).changed ?? 0
      if (changed > 0) {
        this.logger.log(`Sync incremental: ${changed} mudancas comerciais aplicadas.`)
      }
    } catch (error) {
      this.logger.error('Falha no sync incremental do ERP:', error instanceof Error ? error.stack : String(error))
    } finally {
      this.isRunning = false
    }
  }

  @Cron(process.env.ERP_SYNC_CRON || '0 4 * * *', {
    name: 'erp-product-sync',
  })
  async handleScheduledSync(): Promise<void> {
    if (!this.enabled) return

    if (this.isRunning) {
      this.logger.warn('Sync automático do ERP ignorado: uma sincronização anterior ainda está em andamento.')
      return
    }

    this.isRunning = true
    const startedAt = Date.now()
    try {
      this.logger.log('Iniciando sync automático do catálogo com o ERP Solidcom...')
      const result = await this.productsService.syncFromERP()

      if ((result as { skipped?: boolean }).skipped) {
        this.logger.warn(`Sync automático pulado: ${(result as { reason?: string }).reason || 'módulo desativado'}.`)
        return
      }

      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
      this.logger.log(
        `Sync automático concluído em ${elapsed}s: ${(result as { synced?: number }).synced ?? 0} sincronizados, ${(result as { errors?: number }).errors ?? 0} erros.`,
      )
    } catch (error) {
      this.logger.error('Falha no sync automático do ERP:', error instanceof Error ? error.stack : String(error))
    } finally {
      this.isRunning = false
    }
  }
}
