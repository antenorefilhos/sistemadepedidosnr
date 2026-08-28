import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { SolidcomERPService } from '../integrations/solidcom-erp.service'
import { EmailService } from '../notifications/email.service'

/**
 * Rede de seguranca pro bug do "Limao kg" (27/08/2026): o produto estava
 * `SEMPRE` no Solidcom, sumiu da vitrine, e ninguem percebeu ate um cliente
 * dar falta. A causa (o sync incremental sobrescrevendo o syncOption porque
 * o endpoint dele nao manda `tipoIntegracao`) esta corrigida -- ver CLAUDE.md.
 * Este monitor existe pra avisar se ela voltar, por qualquer caminho novo.
 *
 * Roda ANTES do sync completo de propriedade, nao depois: o sync completo e
 * quem CORRIGE o syncOption. Uma checagem posterior nunca acharia nada, porque
 * a janela em que o dado fica errado e justamente o intervalo entre um sync
 * completo e o proximo. Por isso o cron default e 03:30 e o do sync e 04:00.
 *
 * O fetch do ERP e proprio (~190s, uma vez por dia, de madrugada) em vez de
 * reaproveitar o do sync. Custa pouco e mantem o monitor independente: se o
 * sync quebrar, o monitor continua rodando e continua avisando.
 */
@Injectable()
export class MissingProductsMonitor {
  private readonly logger = new Logger(MissingProductsMonitor.name)
  private readonly enabled = String(process.env.MISSING_PRODUCTS_MONITOR_ENABLED || '').toLowerCase() === 'true'
  private readonly alertTo = process.env.MISSING_PRODUCTS_ALERT_EMAIL || ''

  constructor(
    private readonly prisma: PrismaService,
    private readonly erp: SolidcomERPService,
    private readonly email: EmailService,
  ) {}

  @Cron(process.env.MISSING_PRODUCTS_MONITOR_CRON || '30 3 * * *', {
    name: 'missing-products-monitor',
  })
  async handleScheduledCheck(): Promise<void> {
    if (!this.enabled) return
    try {
      const missing = await this.findWronglyHidden()
      if (missing.length === 0) {
        this.logger.log('Monitor de produto sumido: nenhuma divergencia.')
        return
      }
      this.logger.error(
        `Monitor de produto sumido: ${missing.length} produto(s) fora da vitrine com o ERP marcando SEMPRE. ` +
          `EANs: ${missing.map((p) => p.ean).join(', ')}`,
      )
      await this.notify(missing)
    } catch (error) {
      this.logger.error(
        'Falha no monitor de produto sumido:',
        error instanceof Error ? error.stack : String(error),
      )
    }
  }

  /**
   * Produtos que o ERP manda como `SEMPRE` (vendavel ignorando estoque) mas
   * que o nosso banco esconde da vitrine. A regra de visibilidade e a mesma de
   * `isStorefrontVisible`: ativo E syncOption != NUNCA E (SEMPRE OU estoque > 0).
   * Como o ERP diz SEMPRE, so sobra um jeito de sumir: o nosso syncOption
   * divergir E o estoque estar zerado/negativo.
   */
  async findWronglyHidden(): Promise<Array<{ ean: string; name: string; syncOption: string; stock: number }>> {
    const { data } = await this.erp.syncProducts()
    const erpSempre = new Set(
      data.filter((item) => item.syncOption === 'SEMPRE' && item.active).map((item) => item.ean),
    )
    if (erpSempre.size === 0) {
      // Nenhum SEMPRE no retorno inteiro nao e "esta tudo certo" -- e sinal de
      // que o campo parou de vir (o mesmo modo de falha do bug original).
      // Alertar aqui seria ruido; deixar passar calado seria o bug de novo.
      this.logger.warn('Monitor: ERP nao retornou nenhum produto SEMPRE -- campo tipoIntegracao pode ter sumido.')
      return []
    }

    const hidden = await this.prisma.product.findMany({
      where: { active: true, syncOption: { not: 'SEMPRE' }, stock: { lte: 0 } },
      select: { ean: true, name: true, syncOption: true, stock: true },
    })

    return hidden
      .filter((p) => p.ean && erpSempre.has(p.ean))
      .map((p) => ({ ean: p.ean as string, name: p.name, syncOption: p.syncOption, stock: p.stock ?? 0 }))
  }

  private async notify(missing: Array<{ ean: string; name: string; syncOption: string }>): Promise<void> {
    if (!this.alertTo) {
      this.logger.warn('MISSING_PRODUCTS_ALERT_EMAIL nao configurada -- alerta ficou so no log.')
      return
    }
    const linhas = missing
      .slice(0, 50)
      .map((p) => `<li><strong>${p.name}</strong> (EAN ${p.ean}) — no banco: ${p.syncOption}</li>`)
      .join('')
    const extra = missing.length > 50 ? `<p>…e mais ${missing.length - 50}. Lista completa no log da API.</p>` : ''
    await this.email.send(
      this.alertTo,
      `[Antenor] ${missing.length} produto(s) sumiram da vitrine`,
      `<div style="font-family: Arial, sans-serif; max-width: 560px;">
        <h2>Produtos fora da vitrine indevidamente</h2>
        <p>O Solidcom marca estes produtos como <strong>SEMPRE</strong> (vendáveis mesmo sem estoque),
        mas eles não estão aparecendo na loja.</p>
        <ul>${linhas}</ul>
        ${extra}
        <p>O sync completo das 04:00 deve corrigir sozinho. Se o alerta se repetir amanhã,
        o problema está na gravação do <code>syncOption</code> — ver CLAUDE.md.</p>
        <p><em>Depois de corrigir, reindexe o MeiliSearch: o produto volta na categoria
        mas continua sumido na busca até a reindexação.</em></p>
      </div>`,
    )
  }
}
