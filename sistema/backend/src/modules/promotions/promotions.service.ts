import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { AntenorApiService } from '../integrations/antenor-api.service'
import { ProductSearchService } from '../products/product-search.service'
import { parseErpBusinessDate, parseErpBusinessDateEnd, isPromoValidOnDay } from '../../common/business-window'
import { dayWindows, fulfillmentDay, lastCloseOnOrBefore, nextOpenAt, spDay, type HoursConfig } from '../../common/delivery-hours'
import { isProductSellable } from '../../common/product-availability'
import { shortProductName } from '../../common/personalize'
import { loadHoursConfig } from '../../common/promo-day'

const LOWER_WORDS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'com', 'para', 'na', 'no'])

/**
 * Nome do encarte como o cliente le (30/09/2026). O ERP manda "TERÇA
 * HORTIFRUTI NR" -- caixa alta e o codigo da filial no fim. Vira "Terça
 * Hortifruti" no push e na vitrine; o admin continua vendo o nome do ERP.
 */
export function customerCampaignName(raw: string): string {
  const words = String(raw || '')
    .replace(/\s+(NR|NV)\s*$/i, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .filter(Boolean)
  return words
    .map((w, i) => (i > 0 && LOWER_WORDS.has(w) ? w : w.charAt(0).toLocaleUpperCase('pt-BR') + w.slice(1)))
    .join(' ')
}

/** Chave da regra de nome: sem filial, maiusculas, sem acento ("Validade NR" -> VALIDADE). */
export function encarteKey(raw: string): string {
  return String(raw || '')
    .replace(/\s+(NR|NV)\s*$/i, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Nome que o cliente ve: o da regra (EncarteNameRule) ou o do ERP arrumado. */
export function campaignDisplayName(campaign: { name: string; customerName?: string | null }): string {
  return campaign.customerName?.trim() || customerCampaignName(campaign.name)
}

/**
 * Quando saem os avisos de um encarte (02/10/2026). startAt: abertura do primeiro
 * dia, ou agora se ja passou. endAt: 3h antes do ultimo fechamento (nunca antes
 * da abertura daquele dia; agora, se ja passou). expiresAt: o ultimo fechamento
 * -- a oferta sai do site ali. null = encarte ja terminou.
 */
export function encarteSchedule(hours: HoursConfig | null, startDate: Date, endDate: Date, now: Date) {
  const startDay = spDay(startDate)
  const endDay = spDay(endDate)
  let expiresAt: Date
  let endAt: Date
  if (hours) {
    const close = lastCloseOnOrBefore(hours, endDay)
    if (!close) return null
    expiresAt = close
    const lastDayOpen = dayWindows(hours, spDay(close))[0]?.start ?? close
    endAt = new Date(Math.max(close.getTime() - 3 * 3_600_000, lastDayOpen.getTime()))
  } else {
    expiresAt = endDate
    endAt = new Date(endDate.getTime() - 3 * 3_600_000)
  }
  if (now.getTime() >= expiresAt.getTime()) return null
  const firstOpen = hours ? nextOpenAt(hours, new Date(`${startDay}T00:00:00-03:00`)) : new Date(`${startDay}T09:00:00-03:00`)
  const startAt = firstOpen.getTime() < now.getTime() ? (hours ? nextOpenAt(hours, now) : now) : firstOpen
  if (startAt.getTime() >= expiresAt.getTime()) return null
  return { startAt, endAt: endAt.getTime() < now.getTime() ? now : endAt, expiresAt }
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly antenorApiService: AntenorApiService,
    @Optional() private readonly productSearch?: ProductSearchService,
  ) {}

  /** Dia da entrega de um pedido feito agora (ver fulfillmentDay). */
  private async promoDayNow(now = new Date()) {
    return fulfillmentDay(await loadHoursConfig(this.prisma), now)
  }

  /** Preco mudou no banco: a busca (MeiliSearch) tem copia propria e precisa ser atualizada. */
  private async reindex(productIds: Iterable<string>) {
    const ids = [...new Set(productIds)]
    if (ids.length) await this.productSearch?.indexProductsByIds(ids).catch(() => null)
  }

  /**
   * Puxa os encartes/campanhas ativos da AntenorApi (AEF-032/JON-107,
   * v1.10.0) e grava/atualiza PromotionCampaign + itens, aplicando o
   * promotionalPrice no catalogo enquanto a campanha estiver vigente.
   *
   * Antes disso o metodo lia um stub do Solidcom (endpoint nunca confirmado)
   * e nunca sincronizava nada. `isConfigured()` sem endereco/credencial ainda
   * deixa o cron rodar sem quebrar -- so nao ha nada pra sincronizar.
   */
  async syncFromERP(): Promise<{ campaignsSynced: number; itemsSynced: number; productsUpdated: number }> {
    if (!this.antenorApiService.isConfigured()) {
      return { campaignsSynced: 0, itemsSynced: 0, productsUpdated: 0 }
    }
    const campaigns = await this.antenorApiService.getEncartesAtivos()
    const rules = new Map((await this.prisma.encarteNameRule.findMany()).map((r) => [r.key, r]))

    let itemsSynced = 0
    let productsUpdated = 0

    for (const erpCampaign of campaigns) {
      const eans = erpCampaign.items.map((item) => item.ean)
      const products = eans.length
        ? await this.prisma.product.findMany({ where: { ean: { in: eans } }, select: { id: true, ean: true } })
        : []
      const productIdByEan = new Map(products.map((p) => [p.ean, p.id]))

      const rule = rules.get(encarteKey(erpCampaign.name))
      const naming = { customerName: rule?.customerName ?? null, nearExpiry: rule?.nearExpiry ?? false }
      const campaign = await this.prisma.promotionCampaign.upsert({
        where: { erpCampaignId: erpCampaign.erpCampaignId },
        create: {
          ...naming,
          erpCampaignId: erpCampaign.erpCampaignId,
          name: erpCampaign.name,
          slug: slugify(erpCampaign.name),
          startDate: parseErpBusinessDate(erpCampaign.startDate),
          endDate: parseErpBusinessDateEnd(erpCampaign.endDate),
          active: true,
        },
        update: {
          ...naming,
          name: erpCampaign.name,
          startDate: parseErpBusinessDate(erpCampaign.startDate),
          endDate: parseErpBusinessDateEnd(erpCampaign.endDate),
          active: true,
        },
      })

      for (const [order, item] of erpCampaign.items.entries()) {
        const productId = productIdByEan.get(item.ean)
        if (!productId) continue

        const discountPercent =
          item.regularPrice > 0
            ? Math.round((1 - item.promotionalPrice / item.regularPrice) * 10000) / 100
            : null

        await this.prisma.promotionCampaignItem.upsert({
          where: { campaignId_productId: { campaignId: campaign.id, productId } },
          create: {
            campaignId: campaign.id,
            productId,
            ean: item.ean,
            regularPrice: item.regularPrice,
            promotionalPrice: item.promotionalPrice,
            discountPercent,
            order,
            highlightCover: item.highlightCover ?? false,
            strongSuggestion: item.strongSuggestion ?? false,
            wholesaleMinQty: item.wholesaleMinQty ?? null,
            wholesalePrice: item.wholesalePrice ?? null,
            clubPrice: item.clubPrice ?? null,
          },
          update: {
            ean: item.ean,
            regularPrice: item.regularPrice,
            promotionalPrice: item.promotionalPrice,
            discountPercent,
            order,
            highlightCover: item.highlightCover ?? false,
            strongSuggestion: item.strongSuggestion ?? false,
            wholesaleMinQty: item.wholesaleMinQty ?? null,
            wholesalePrice: item.wholesalePrice ?? null,
            clubPrice: item.clubPrice ?? null,
          },
        })
        itemsSynced += 1
        // JON-171: NAO aplica promotionalPrice aqui. Sync so registra o
        // cadastro (campanha + itens); a vigencia real (startDate<=now<=
        // endDate) e checada exclusivamente por activateCampaigns() abaixo.
        // Sem essa separacao, um encarte futuro ja recebido do ERP tinha
        // seu preco promocional aplicado ao catalogo na hora do sync, dias
        // ou horas antes de comecar de verdade.
      }

      // Poda: sem isso, item que sai do encarte (ou que entrou errado por um
      // bug de join do lado do ERP -- foi exatamente o que aconteceu com o
      // encarte 372 na v1.10.0, AEF-033/JON-108) nunca sai do nosso banco. O
      // upsert acima so cria/atualiza os itens ATUAIS; o que sobrou de uma
      // sincronizacao anterior fica orfao pra sempre.
      const currentProductIds = new Set(erpCampaign.items.map((item) => productIdByEan.get(item.ean)).filter(Boolean) as string[])
      const staleItems = await this.prisma.promotionCampaignItem.findMany({
        where: { campaignId: campaign.id, productId: { notIn: [...currentProductIds] } },
        include: { product: { select: { id: true, promotionalPrice: true } } },
      })
      for (const stale of staleItems) {
        // So limpa o promotionalPrice do produto se ele ainda bate com o que
        // ESTE item de campanha aplicou -- mesma cautela de expireCampaigns,
        // pra nao apagar uma promocao mais nova que outra coisa aplicou por cima.
        const currentPrice = stale.product.promotionalPrice
        const stillCampaignPrice = currentPrice != null && Math.abs(Number(currentPrice) - Number(stale.promotionalPrice)) < 0.005
        if (stillCampaignPrice) {
          await this.prisma.product.update({ where: { id: stale.productId }, data: { promotionalPrice: null, promotionalPriceValidUntil: null } })
          await this.reindex([stale.productId])
        }
      }
      if (staleItems.length > 0) {
        await this.prisma.promotionCampaignItem.deleteMany({
          where: { id: { in: staleItems.map((s) => s.id) } },
        })
      }
    }

    // JON-171: ativa na mesma chamada quem ja estiver vigente agora (sync
    // manual do admin nao deve esperar o proximo tick do scheduler pra um
    // encarte que ja comecou aparecer com preco certo).
    const activation = await this.activateCampaigns()
    productsUpdated = activation.productsActivated

    if (campaigns.length > 0) {
      this.logger.log(
        `Sync de encartes: ${campaigns.length} campanha(s), ${itemsSynced} item(ns), ${productsUpdated} produto(s) com preco atualizado.`,
      )
    }

    return { campaignsSynced: campaigns.length, itemsSynced, productsUpdated }
  }

  /**
   * Unico lugar que aplica o preco do encarte ao catalogo. Vale a campanha cujo
   * periodo contem o DIA DA ENTREGA de um pedido feito agora (02/10/2026): com a
   * loja fechada, o encarte de amanha ja aparece (o pedido sera entregue nele) e
   * o que acaba hoje some. Grava tambem a validade no produto, para o checkout
   * cobrar preco cheio em pedido agendado para depois do fim (JON-187).
   * Idempotente: seguro de chamar repetidamente.
   */
  async activateCampaigns(): Promise<{ campaignsActivated: number; productsActivated: number }> {
    const now = new Date()
    const day = await this.promoDayNow(now)
    const candidates = (
      await this.prisma.promotionCampaign.findMany({
        where: { active: true, endDate: { gte: now } },
        include: { items: { include: { product: { select: { id: true, promotionalPrice: true, promotionalPriceValidUntil: true } } } } },
      })
    ).filter((campaign) => isPromoValidOnDay(day, campaign.startDate, campaign.endDate))

    const touched: string[] = []
    for (const campaign of candidates) {
      for (const item of campaign.items) {
        const currentPrice = item.product.promotionalPrice
        const samePrice = currentPrice != null && Math.abs(Number(currentPrice) - Number(item.promotionalPrice)) < 0.005
        const sameEnd = item.product.promotionalPriceValidUntil?.getTime() === campaign.endDate.getTime()
        if (samePrice && sameEnd) continue
        await this.prisma.product.update({
          where: { id: item.productId },
          data: { promotionalPrice: Number(item.promotionalPrice), promotionalPriceValidUntil: campaign.endDate },
        })
        touched.push(item.productId)
      }
    }
    await this.reindex(touched)

    if (touched.length > 0) {
      this.logger.log(`Ativacao de encartes: ${candidates.length} campanha(s) vigente(s), ${touched.length} produto(s) com preco aplicado.`)
    }

    return { campaignsActivated: candidates.length, productsActivated: touched.length }
  }

  /**
   * Limpa campanhas vencidas: desativa a campanha e remove o
   * promotionalPrice do catalogo -- so quando o preco atual ainda bate com
   * o preco que a propria campanha aplicou (heuristica pra nao apagar uma
   * promocao mais nova que o sync do catalogo tenha aplicado por cima).
   */
  async expireCampaigns(): Promise<{ campaignsExpired: number; productsCleared: number }> {
    const now = new Date()
    const day = await this.promoDayNow(now)
    // Acabou para o site quando o dia da entrega passou do ultimo dia: no
    // fechamento da loja no ultimo dia, nao a meia-noite (02/10/2026).
    const expiring = await this.prisma.promotionCampaign.findMany({
      where: { active: true, endDate: { lt: new Date(now.getTime() + 15 * 86_400_000) } },
      include: { items: { include: { product: { select: { id: true, promotionalPrice: true } } } } },
    })

    let productsCleared = 0
    const cleared: string[] = []
    const ended = expiring.filter((campaign) => day > spDay(campaign.endDate))
    for (const campaign of ended) {
      for (const item of campaign.items) {
        const currentPrice = item.product.promotionalPrice
        const stillCampaignPrice =
          currentPrice != null && Math.abs(Number(currentPrice) - Number(item.promotionalPrice)) < 0.005
        if (!stillCampaignPrice) continue

        await this.prisma.product.update({
          where: { id: item.productId },
          data: { promotionalPrice: null, promotionalPriceValidUntil: null },
        })
        productsCleared += 1
        cleared.push(item.productId)
      }

      await this.prisma.promotionCampaign.update({
        where: { id: campaign.id },
        data: { active: false },
      })
    }

    // Oferta por produto que veio do ERP com validade (PROMOCAO_VALIDA_ATE):
    // mesma regra. O sync nao reaplica depois do fechamento (products.service).
    const feedEnded = await this.prisma.product.findMany({
      where: { promotionalPrice: { not: null }, promotionalPriceValidUntil: { not: null, lt: new Date(now.getTime() + 15 * 86_400_000) } },
      select: { id: true, promotionalPriceValidUntil: true },
    })
    for (const product of feedEnded) {
      if (!(day > spDay(product.promotionalPriceValidUntil as Date))) continue
      await this.prisma.product.update({ where: { id: product.id }, data: { promotionalPrice: null, promotionalPriceValidUntil: null } })
      productsCleared += 1
      cleared.push(product.id)
    }
    await this.reindex(cleared)

    if (ended.length > 0 || productsCleared > 0) {
      this.logger.log(`${ended.length} campanha(s) expirada(s), ${productsCleared} produto(s) com promocao limpa.`)
    }

    return { campaignsExpired: ended.length, productsCleared }
  }

  /**
   * Planeja os avisos de encarte na FILA DE ENVIOS (02/10/2026) -- nao envia
   * nada: quem envia e o NotificationQueueService, na hora marcada, e a tela
   * Notificacoes > Fila mostra, edita, cancela e manda na hora.
   *
   * Dois avisos por encarte, sempre com a loja aberta:
   * - inicio: na abertura do primeiro dia (ou agora, se o encarte chegou atrasado);
   * - fim: 3h antes de a oferta sair do site, que e o fechamento do ultimo dia.
   * Idempotente pela sourceKey; o que o admin editou nao e sobrescrito, e o que
   * ele cancelou nao volta. Encarte que saiu do ERP ou terminou: o que ainda nao
   * saiu e cancelado com o motivo.
   */
  async planCampaignNotifications(now = new Date()): Promise<{ planned: number; updated: number; cancelled: number }> {
    const settings = await this.prisma.autoOfferSettings.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } })
    const hours = await loadHoursConfig(this.prisma)
    const campaigns = await this.prisma.promotionCampaign.findMany({
      where: { endDate: { gte: new Date(now.getTime() - 2 * 86_400_000) } },
      include: { items: { include: { product: { select: { name: true, titleMask: true, active: true, syncOption: true, stock: true, isFractional: true } } } } },
    })

    let planned = 0
    let updated = 0
    let cancelled = 0
    for (const campaign of campaigns) {
      const keys = [`encarte:${campaign.id}:inicio`, `encarte:${campaign.id}:fim`]
      const plan = encarteSchedule(hours, campaign.startDate, campaign.endDate, now)
      const stopReason = !campaign.active
        ? 'O encarte saiu do ERP.'
        : !settings.encarteEnabled
          ? 'Avisos de encarte desligados na fila.'
          : !plan
            ? 'O encarte já terminou.'
            : null
      if (stopReason) {
        const r = await this.prisma.scheduledNotification.updateMany({
          where: { sourceKey: { in: keys }, status: { in: ['SCHEDULED', 'PENDING_APPROVAL'] } },
          data: { status: 'CANCELLED', note: stopReason, cancelledAt: now },
        })
        cancelled += r.count
        continue
      }

      const name = campaignDisplayName(campaign)
      const offers = campaign.items
        .filter((i) => isProductSellable(i.product) && Number(i.promotionalPrice) < Number(i.regularPrice))
        .sort((a, b) => Number(b.discountPercent ?? 0) - Number(a.discountPercent ?? 0))
      const best = offers[0]
      const brl = (v: unknown) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ')
      const bestText = best
        ? `${shortProductName(best.product.titleMask || best.product.name)} de ${brl(best.regularPrice)} por ${brl(best.promotionalPrice)}${best.product.isFractional ? '/kg' : ''}${offers.length > 1 ? ` e mais ${offers.length - 1} oferta${offers.length > 2 ? 's' : ''}` : ''}.`
        : 'Confira as ofertas.'
      const closeLabel = plan!.expiresAt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
      const base = {
        tenantId: campaign.tenantId,
        type: 'CAMPAIGN',
        url: campaign.erpCampaignId ? `/encarte/${campaign.erpCampaignId}` : '/promocoes',
        audienceLabel: 'Todos os clientes com conta',
        respectHours: true,
        expiresAt: plan!.expiresAt,
        meta: { campaignId: campaign.id, erpCampaignId: campaign.erpCampaignId, campaign: name, erpName: campaign.name, offers: offers.length, items: campaign.items.length, nearExpiry: campaign.nearExpiry },
      }
      const wanted: Array<{ key: string; origin: string; sendAt: Date; title: string; body: string }> = []
      if (!campaign.startNotifiedAt) {
        wanted.push({ key: keys[0], origin: 'ENCARTE_INICIO', sendAt: plan!.startAt, title: `🛍️ Já está no ar: ${name}`, body: bestText })
      }
      // Encarte que chegou atrasado (inicio e fim colados): so o de inicio.
      const tooClose = !campaign.startNotifiedAt && plan!.endAt.getTime() - plan!.startAt.getTime() < 60 * 60_000
      if (!campaign.endingNotifiedAt && !tooClose) {
        wanted.push({ key: keys[1], origin: 'ENCARTE_FIM', sendAt: plan!.endAt, title: `⏰ Últimas horas: ${name}`, body: `Termina hoje às ${closeLabel}. ${bestText}` })
      }

      for (const item of wanted) {
        const existing = await this.prisma.scheduledNotification.findUnique({ where: { sourceKey: item.key } })
        if (!existing) {
          await this.prisma.scheduledNotification.create({
            data: {
              ...base,
              sourceKey: item.key,
              origin: item.origin,
              status: settings.encarteApproval ? 'PENDING_APPROVAL' : 'SCHEDULED',
              sendAt: item.sendAt,
              title: item.title.slice(0, 80),
              body: item.body.slice(0, 180),
            },
          })
          planned += 1
          continue
        }
        // Cancelado pelo sistema porque o tipo estava desligado: religou, volta.
        if (existing.status === 'CANCELLED' && existing.note === 'Avisos de encarte desligados na fila.') {
          await this.prisma.scheduledNotification.update({
            where: { id: existing.id },
            data: { ...base, status: settings.encarteApproval ? 'PENDING_APPROVAL' : 'SCHEDULED', note: null, cancelledAt: null, sendAt: item.sendAt, title: item.title.slice(0, 80), body: item.body.slice(0, 180) },
          })
          planned += 1
          continue
        }
        if (!['SCHEDULED', 'PENDING_APPROVAL'].includes(existing.status)) continue
        // Editado pelo admin: so atualiza o que nao e conteudo (validade e contexto).
        await this.prisma.scheduledNotification.update({
          where: { id: existing.id },
          data: existing.editedAt
            ? { expiresAt: base.expiresAt, meta: base.meta }
            : { ...base, sendAt: item.sendAt, title: item.title.slice(0, 80), body: item.body.slice(0, 180) },
        })
        updated += 1
      }
    }

    if (planned || cancelled) this.logger.log(`Fila de encartes: ${planned} aviso(s) planejado(s), ${cancelled} cancelado(s).`)
    return { planned, updated, cancelled }
  }

  /** Regras de nome (tela Notificacoes > Fila). Cada regra mostra os encartes que ela cobre agora. */
  async listNameRules() {
    const [rules, campaigns] = await Promise.all([
      this.prisma.encarteNameRule.findMany({ orderBy: { key: 'asc' } }),
      this.prisma.promotionCampaign.findMany({ where: { endDate: { gte: new Date(Date.now() - 30 * 86_400_000) } }, select: { name: true }, orderBy: { startDate: 'desc' } }),
    ])
    // Nome original mais recente por chave: o automatico sai dele (a chave nao tem acento).
    const original = new Map<string, string>()
    for (const c of campaigns) if (!original.has(encarteKey(c.name))) original.set(encarteKey(c.name), c.name)
    return {
      rules,
      // Nomes do ERP dos ultimos 30 dias, com o que o cliente ve hoje -- base para criar regra.
      erpNames: [...original.entries()].map(([key, name]) => {
        const rule = rules.find((r) => r.key === key)
        return { key, erpName: name, customerName: rule?.customerName ?? customerCampaignName(name), hasRule: Boolean(rule), nearExpiry: rule?.nearExpiry ?? false }
      }),
    }
  }

  async saveNameRule(input: { key: string; customerName: string; nearExpiry?: boolean }) {
    const key = encarteKey(input.key)
    const customerName = String(input.customerName || '').trim().slice(0, 60)
    if (!key || !customerName) throw new BadRequestException('Informe o nome do encarte no ERP e o nome para o cliente.')
    const nearExpiry = Boolean(input.nearExpiry)
    const rule = await this.prisma.encarteNameRule.upsert({ where: { key }, update: { customerName, nearExpiry }, create: { key, customerName, nearExpiry } })
    await this.applyNameRule(key, { customerName, nearExpiry })
    // Os avisos ainda na fila passam a usar o nome novo (o que foi editado a mao fica).
    await this.planCampaignNotifications().catch(() => null)
    return rule
  }

  async deleteNameRule(key: string) {
    const k = encarteKey(key)
    await this.prisma.encarteNameRule.deleteMany({ where: { key: k } })
    await this.applyNameRule(k, { customerName: null, nearExpiry: false })
    await this.planCampaignNotifications().catch(() => null)
    return { ok: true }
  }

  /** Aplica a regra aos encartes ja gravados (vigentes e futuros) com essa chave. */
  private async applyNameRule(key: string, naming: { customerName: string | null; nearExpiry: boolean }) {
    const campaigns = await this.prisma.promotionCampaign.findMany({ where: { endDate: { gte: new Date() } }, select: { id: true, name: true } })
    const ids = campaigns.filter((c) => encarteKey(c.name) === key).map((c) => c.id)
    if (ids.length) await this.prisma.promotionCampaign.updateMany({ where: { id: { in: ids } }, data: naming })
  }

  findAllAdmin() {
    return this.prisma.promotionCampaign.findMany({
      orderBy: { startDate: 'desc' },
      include: { items: { select: { id: true } } },
    })
  }

  /**
   * Campanhas vigentes agora (startDate <= now <= endDate), com os itens já
   * juntados aos dados do produto -- fonte da vitrine de ofertas do encarte
   * no Storefront.
   */
  async findActiveForStorefront() {
    const now = new Date()
    const day = await this.promoDayNow(now)
    const campaigns = await this.prisma.promotionCampaign.findMany({
      where: {
        active: true,
        endDate: { gte: now },
      },
      orderBy: { highlightInHome: 'desc' },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { product: true },
        },
      },
    })

    return campaigns
      .filter((campaign) => isPromoValidOnDay(day, campaign.startDate, campaign.endDate))
      .map((campaign) => this.mapCampaignForStorefront(campaign))
  }

  /**
   * Um encarte especifico com seus itens, pelo `erpCampaignId` (o mesmo
   * numero que o lojista digita no campo "Código do encarte" do banner) --
   * destino do clique quando o banner aponta pra "Produtos do encarte"
   * (linkType='campaign'). `null` se nao existir, ja acabou ou o numero for
   * invalido -- o storefront mostra "encarte nao encontrado" nesse caso.
   */
  async findOneForStorefront(erpCampaignId: number) {
    if (!Number.isFinite(erpCampaignId)) return null
    const campaign = await this.prisma.promotionCampaign.findUnique({
      where: { erpCampaignId },
      include: { items: { orderBy: { order: 'asc' }, include: { product: true } } },
    })
    // JON-171: faltava a mesma checagem de janela de findActiveForStorefront
    // -- clique no banner de um encarte cadastrado mas ainda futuro (ou ja
    // vencido) mostrava os produtos e o preco promocional mesmo assim.
    if (!campaign || !campaign.active || !isPromoValidOnDay(await this.promoDayNow(), campaign.startDate, campaign.endDate)) {
      return null
    }
    return this.mapCampaignForStorefront(campaign)
  }

  private mapCampaignForStorefront(campaign: {
    id: string
    name: string
    customerName?: string | null
    nearExpiry?: boolean
    slug: string
    type: string
    bannerUrl: string | null
    startDate: Date
    endDate: Date
    highlightInHome: boolean
    items: Array<{
      product: unknown
      regularPrice: unknown
      promotionalPrice: unknown
      discountPercent: unknown
      highlightCover?: boolean
      strongSuggestion?: boolean
      wholesaleMinQty?: number | null
      wholesalePrice?: unknown
      clubPrice?: unknown
    }>
  }) {
    return {
      id: campaign.id,
      name: campaignDisplayName(campaign),
      nearExpiry: Boolean(campaign.nearExpiry),
      slug: campaign.slug,
      type: campaign.type,
      bannerUrl: campaign.bannerUrl,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      highlightInHome: campaign.highlightInHome,
      items: campaign.items.map((item) => ({
        ...(item.product as object),
        regularPrice: item.regularPrice,
        promotionalPrice: item.promotionalPrice,
        discountPercent: item.discountPercent,
        highlightCover: item.highlightCover ?? false,
        strongSuggestion: item.strongSuggestion ?? false,
        wholesaleMinQty: item.wholesaleMinQty ?? null,
        wholesalePrice: item.wholesalePrice ?? null,
        clubPrice: item.clubPrice ?? null,
      })),
    }
  }

  async setActive(id: string, active: boolean) {
    return this.prisma.promotionCampaign.update({ where: { id }, data: { active } })
  }

  async setHighlightInHome(id: string, highlightInHome: boolean) {
    return this.prisma.promotionCampaign.update({ where: { id }, data: { highlightInHome } })
  }

  async remove(id: string) {
    return this.prisma.promotionCampaign.delete({ where: { id } })
  }
}
