import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { AntenorApiService } from '../integrations/antenor-api.service'
import { IntegrationModulesService } from '../integrations/integration-modules.service'
import { EmailService } from '../notifications/email.service'
import { TelegramService } from '../notifications/telegram.service'
import { winstonLogger } from '../../common/logger'
import { isSempreValidadoPeloMostruario, parseMostruarioSalvos } from '../../common/product-availability'

const DEFAULT_FILIAL_ID = 1

/**
 * Rede de seguranca pro bug do "Limao kg" (27/08/2026): o produto estava
 * `SEMPRE` no Solidcom, sumiu da vitrine, e ninguem percebeu ate um cliente
 * dar falta. A causa (o sync incremental sobrescrevendo o syncOption porque
 * o endpoint dele nao manda `tipoIntegracao`) esta corrigida -- ver CLAUDE.md.
 * Este monitor existe pra avisar se ela voltar, por qualquer caminho novo.
 *
 * Migrado de SolidcomERPService pra AntenorApiService em 17/10/2026: o modulo
 * Solidcom esta `enabled: false` desde 10/09/2026 (ver integration_module_configs),
 * e esse monitor era o unico ponto do sistema ainda lendo o ERP legado direto --
 * `ERPProduct` e a mesma interface nos dois services, troca sem mudar a logica
 * de comparacao. Ganhou a mesma checagem de modulo ligado que o
 * PdvCancellationScheduler ja fazia (e este monitor nao fazia).
 *
 * Na mesma migracao: o `SEMPRE` da AntenorApi so e confiavel quando validado
 * pelo Motor de Presenca Real (`/mostruario/produtos-salvos`) -- exatamente a
 * mesma checagem que `ProductsService.downgradeUnvalidatedSempre` ja faz no
 * sync (23/09/2026, 178 produtos com SEMPRE sem venda real). Sem isso este
 * monitor alertaria todo dia para produto que o proprio sync ja rebaixa de
 * proposito, nao para um bug. A regra mora em
 * `common/product-availability.ts`, usada pelos dois lugares -- nao duplicada.
 *
 * Roda ANTES do sync completo de propriedade, nao depois: o sync completo e
 * quem CORRIGE o syncOption. Uma checagem posterior nunca acharia nada, porque
 * a janela em que o dado fica errado e justamente o intervalo entre um sync
 * completo e o proximo. Por isso o cron default e 03:30 e o do sync e 04:00.
 *
 * O fetch do ERP e proprio (uma vez por dia, de madrugada) em vez de
 * reaproveitar o do sync. Custa pouco e mantem o monitor independente: se o
 * sync quebrar, o monitor continua rodando e continua avisando.
 */
@Injectable()
export class MissingProductsMonitor {
  private readonly enabled = String(process.env.MISSING_PRODUCTS_MONITOR_ENABLED || '').toLowerCase() === 'true'
  private readonly alertTo = process.env.MISSING_PRODUCTS_ALERT_EMAIL || ''

  constructor(
    private readonly prisma: PrismaService,
    private readonly erp: AntenorApiService,
    private readonly integrationModules: IntegrationModulesService,
    private readonly email: EmailService,
    private readonly telegram: TelegramService,
  ) {
    // Sem esta linha nao ha como saber, olhando o log, se o monitor esta de pe:
    // um monitor calado por estar desligado e indistinguivel de um calado por
    // nao ter achado nada -- que e a propria falha silenciosa que ele monitora.
    //
    // Tudo aqui usa winstonLogger, nunca o Logger do Nest: `main.ts` cria a app
    // com `logger: false`, entao Logger do Nest nao sai em lugar nenhum em
    // producao. Varios schedulers do projeto ainda logam por ele e sao mudos na
    // VPS -- nao copie esse padrao.
    if (!this.enabled) {
      winstonLogger.info('missing_products_monitor_disabled')
      return
    }
    winstonLogger.info('missing_products_monitor_ready', {
      cron: process.env.MISSING_PRODUCTS_MONITOR_CRON || '30 3 * * *',
      alertEmail: this.alertTo || 'nao configurado',
      alertTelegram: 'sempre tenta (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID)',
    })
  }

  @Cron(process.env.MISSING_PRODUCTS_MONITOR_CRON || '30 3 * * *', {
    name: 'missing-products-monitor',
  })
  async handleScheduledCheck(): Promise<void> {
    if (!this.enabled) return
    try {
      const missing = await this.findWronglyHidden()
      if (missing.length === 0) {
        winstonLogger.info('missing_products_check_clean')
        return
      }
      // Copia duravel do alerta: e o que fica quando o e-mail nao sai.
      winstonLogger.error('missing_products_detected', {
        count: missing.length,
        eans: missing.map((p) => p.ean),
        names: missing.map((p) => p.name),
      })
      await this.notify(missing)
    } catch (error) {
      winstonLogger.error('missing_products_monitor_failed', {
        error: error instanceof Error ? error.stack : String(error),
      })
    }
  }

  /**
   * Produtos que o ERP manda como `SEMPRE` (vendavel ignorando estoque),
   * validado pelo Motor de Presenca Real, mas que o nosso banco esconde da
   * vitrine. A regra de visibilidade e a mesma de `isStorefrontVisible`:
   * ativo E syncOption != NUNCA E (SEMPRE OU estoque > 0). Como o ERP diz
   * SEMPRE validado, so sobra um jeito de sumir: o nosso syncOption
   * divergir E o estoque estar zerado/negativo.
   */
  async findWronglyHidden(): Promise<Array<{ ean: string; name: string; syncOption: string; stock: number }>> {
    if (!(await this.integrationModules.isEnabled('antenorapi'))) {
      winstonLogger.warn('missing_products_antenorapi_disabled')
      return []
    }
    const { data } = await this.erp.syncProducts()
    const erpSempreRaw = data.filter((item) => item.syncOption === 'SEMPRE' && item.active)
    if (erpSempreRaw.length === 0) {
      // Nenhum SEMPRE no retorno inteiro nao e "esta tudo certo" -- e sinal de
      // que o campo parou de vir (o mesmo modo de falha do bug original).
      // Alertar aqui seria ruido; deixar passar calado seria o bug de novo.
      winstonLogger.warn('missing_products_erp_no_sempre', { erpRows: data.length })
      return []
    }

    let salvos: unknown[]
    try {
      salvos = await this.erp.getMostruarioProdutosSalvos(DEFAULT_FILIAL_ID)
    } catch (error) {
      // Sem a lista de validados nao da pra distinguir SEMPRE confiavel de
      // SEMPRE cru-nao-validado -- alertar aqui seria o falso positivo que
      // esta checagem existe pra evitar.
      winstonLogger.warn('missing_products_mostruario_indisponivel', {
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
    const validados = parseMostruarioSalvos(salvos)

    const erpSempre = new Set(
      erpSempreRaw.filter((item) => isSempreValidadoPeloMostruario(item.erpProductId, validados)).map((item) => item.ean),
    )
    if (erpSempre.size === 0) {
      winstonLogger.info('missing_products_sempre_sem_validacao', { erpSempreRaw: erpSempreRaw.length })
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

  /**
   * Telegram e e-mail, cada um melhor-esforco e independente: e-mail so sai
   * se `MISSING_PRODUCTS_ALERT_EMAIL` estiver preenchida (opcional), Telegram
   * sempre tenta (mesmo bot do check-up diario, ja configurado em producao --
   * 17/10/2026, pedido do Jonathan por nao depender so de e-mail). Se os dois
   * falharem, so resta o log de erro que `handleScheduledCheck` ja gravou.
   */
  private async notify(missing: Array<{ ean: string; name: string; syncOption: string }>): Promise<void> {
    const amostra = missing.slice(0, 50)
    const extraCount = missing.length - amostra.length

    const linhasTexto = amostra.map((p) => `• ${p.name} (EAN ${p.ean}) — no banco: ${p.syncOption}`)
    const telegramText = [
      `⚠️ ${missing.length} produto(s) sumiram da vitrine indevidamente`,
      '',
      ...linhasTexto,
      ...(extraCount > 0 ? [`…e mais ${extraCount}. Lista completa no log da API.`] : []),
    ].join('\n')
    const telegramSent = await this.telegram.send(telegramText)

    let emailSent = false
    if (this.alertTo) {
      const linhasHtml = amostra
        .map((p) => `<li><strong>${p.name}</strong> (EAN ${p.ean}) — no banco: ${p.syncOption}</li>`)
        .join('')
      const extraHtml = extraCount > 0 ? `<p>…e mais ${extraCount}. Lista completa no log da API.</p>` : ''
      emailSent = await this.email.send(
        this.alertTo,
        `[Antenor] ${missing.length} produto(s) sumiram da vitrine`,
        `<div style="font-family: Arial, sans-serif; max-width: 560px;">
          <h2>Produtos fora da vitrine indevidamente</h2>
          <p>O ERP marca estes produtos como <strong>SEMPRE</strong> (vendáveis mesmo sem estoque, com venda
          real recente confirmada), mas eles não estão aparecendo na loja.</p>
          <ul>${linhasHtml}</ul>
          ${extraHtml}
          <p>O sync completo das 04:00 deve corrigir sozinho. Se o alerta se repetir amanhã,
          o problema está na gravação do <code>syncOption</code> — ver CLAUDE.md.</p>
          <p><em>Depois de corrigir, reindexe o MeiliSearch: o produto volta na categoria
          mas continua sumido na busca até a reindexação.</em></p>
        </div>`,
      )
    }

    if (!telegramSent && !emailSent) {
      winstonLogger.warn('missing_products_alert_sem_canal', { count: missing.length })
    }
  }
}
