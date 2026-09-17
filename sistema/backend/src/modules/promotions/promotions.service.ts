import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { AntenorApiService } from '../integrations/antenor-api.service'
import { NotificationsService } from '../notifications/notifications.service'
import { parseErpBusinessDate, isWithinBusinessWindow } from '../../common/business-window'

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
    private readonly notificationsService: NotificationsService,
  ) {}

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

    let itemsSynced = 0
    let productsUpdated = 0

    for (const erpCampaign of campaigns) {
      const eans = erpCampaign.items.map((item) => item.ean)
      const products = eans.length
        ? await this.prisma.product.findMany({ where: { ean: { in: eans } }, select: { id: true, ean: true } })
        : []
      const productIdByEan = new Map(products.map((p) => [p.ean, p.id]))

      const campaign = await this.prisma.promotionCampaign.upsert({
        where: { erpCampaignId: erpCampaign.erpCampaignId },
        create: {
          erpCampaignId: erpCampaign.erpCampaignId,
          name: erpCampaign.name,
          slug: slugify(erpCampaign.name),
          startDate: parseErpBusinessDate(erpCampaign.startDate),
          endDate: parseErpBusinessDate(erpCampaign.endDate),
          active: true,
        },
        update: {
          name: erpCampaign.name,
          startDate: parseErpBusinessDate(erpCampaign.startDate),
          endDate: parseErpBusinessDate(erpCampaign.endDate),
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
          },
          update: {
            ean: item.ean,
            regularPrice: item.regularPrice,
            promotionalPrice: item.promotionalPrice,
            discountPercent,
            order,
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
          await this.prisma.product.update({ where: { id: stale.productId }, data: { promotionalPrice: null } })
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
   * JON-171: unico lugar que aplica promotionalPrice ao catalogo. So
   * campanhas com active=true E startDate<=now<=endDate (janela real, com
   * datas ja parseadas por parseErpBusinessDate) tocam Product.promotionalPrice.
   * Idempotente: reaplicar num produto que ja esta no preco certo nao gera
   * escrita nem efeito colateral -- seguro de chamar repetidamente (sync
   * manual, cron de ativacao, campanhas sobrepostas no mesmo produto).
   */
  async activateCampaigns(): Promise<{ campaignsActivated: number; productsActivated: number }> {
    const now = new Date()
    const candidates = await this.prisma.promotionCampaign.findMany({
      where: { active: true, startDate: { lte: now }, endDate: { gte: now } },
      include: { items: { include: { product: { select: { id: true, promotionalPrice: true } } } } },
    })

    let productsActivated = 0
    for (const campaign of candidates) {
      if (!isWithinBusinessWindow(campaign.startDate, campaign.endDate, now)) continue
      for (const item of campaign.items) {
        const currentPrice = item.product.promotionalPrice
        const alreadyApplied = currentPrice != null && Math.abs(Number(currentPrice) - Number(item.promotionalPrice)) < 0.005
        if (alreadyApplied) continue
        await this.prisma.product.update({
          where: { id: item.productId },
          data: { promotionalPrice: Number(item.promotionalPrice) },
        })
        productsActivated += 1
      }
    }

    if (productsActivated > 0) {
      this.logger.log(`Ativacao de encartes: ${candidates.length} campanha(s) vigente(s), ${productsActivated} produto(s) com preco aplicado.`)
    }

    return { campaignsActivated: candidates.length, productsActivated }
  }

  /**
   * Limpa campanhas vencidas: desativa a campanha e remove o
   * promotionalPrice do catalogo -- so quando o preco atual ainda bate com
   * o preco que a propria campanha aplicou (heuristica pra nao apagar uma
   * promocao mais nova que o sync do catalogo tenha aplicado por cima).
   */
  async expireCampaigns(): Promise<{ campaignsExpired: number; productsCleared: number }> {
    const now = new Date()
    const expiring = await this.prisma.promotionCampaign.findMany({
      where: { active: true, endDate: { lt: now } },
      include: { items: { include: { product: { select: { id: true, promotionalPrice: true } } } } },
    })

    let productsCleared = 0
    for (const campaign of expiring) {
      for (const item of campaign.items) {
        const currentPrice = item.product.promotionalPrice
        const stillCampaignPrice =
          currentPrice != null && Math.abs(Number(currentPrice) - Number(item.promotionalPrice)) < 0.005
        if (!stillCampaignPrice) continue

        await this.prisma.product.update({
          where: { id: item.productId },
          data: { promotionalPrice: null },
        })
        productsCleared += 1
      }

      await this.prisma.promotionCampaign.update({
        where: { id: campaign.id },
        data: { active: false },
      })
    }

    if (expiring.length > 0) {
      this.logger.log(`${expiring.length} campanha(s) expirada(s), ${productsCleared} produto(s) com promocao limpa.`)
    }

    return { campaignsExpired: expiring.length, productsCleared }
  }

  /**
   * Avisa por push quando um encarte entra em vigencia e quando esta perto
   * de acabar (endDate dentro de 3h). Cada aviso dispara uma vez so, marcado
   * por startNotifiedAt/endingNotifiedAt.
   */
  async notifyCampaignLifecycle(): Promise<{ started: number; ending: number }> {
    const now = new Date()

    const startingCandidates = await this.prisma.promotionCampaign.findMany({
      where: { active: true, startDate: { lte: now }, startNotifiedAt: null },
    })
    let started = 0
    for (const campaign of startingCandidates) {
      if (!isWithinBusinessWindow(campaign.startDate, campaign.endDate, now)) continue
      // JON-171: claim atomico ANTES de enviar -- so quem consegue essa
      // transicao (startNotifiedAt ainda null no banco) segue pro push.
      // Duas execucoes concorrentes do scheduler (ou um disparo manual junto
      // com o cron) nao mandam a mesma notificacao duas vezes.
      const claim = await this.prisma.promotionCampaign.updateMany({
        where: { id: campaign.id, startNotifiedAt: null },
        data: { startNotifiedAt: now },
      })
      if (claim.count === 0) continue
      try {
        const customerIds = await this.notificationsService.getAllCustomerIds()
        await this.notificationsService.broadcastToCustomers(customerIds, {
          type: 'CAMPAIGN',
          title: `🛍️ Chegou o encarte ${campaign.name}!`,
          body: 'Confira as ofertas antes que acabem.',
          url: '/promocoes',
        })
        started += 1
      } catch (error) {
        // Claim ja feito de proposito: prefere perder um aviso a mandar
        // dobrado se o proximo tick tentar de novo. Erro fica so no log.
        this.logger.error(`Falha ao enviar push de inicio do encarte ${campaign.id}:`, error instanceof Error ? error.stack : String(error))
      }
    }

    const endingCandidates = await this.prisma.promotionCampaign.findMany({
      where: {
        active: true,
        endDate: { gte: now, lte: new Date(now.getTime() + 3 * 60 * 60 * 1000) },
        endingNotifiedAt: null,
      },
    })
    let ending = 0
    for (const campaign of endingCandidates) {
      const claim = await this.prisma.promotionCampaign.updateMany({
        where: { id: campaign.id, endingNotifiedAt: null },
        data: { endingNotifiedAt: now },
      })
      if (claim.count === 0) continue
      try {
        const customerIds = await this.notificationsService.getAllCustomerIds()
        await this.notificationsService.broadcastToCustomers(customerIds, {
          type: 'CAMPAIGN',
          title: `⏰ Ultimas horas do encarte ${campaign.name}!`,
          body: 'As ofertas terminam em breve, aproveite agora.',
          url: '/promocoes',
        })
        ending += 1
      } catch (error) {
        this.logger.error(`Falha ao enviar push de fim do encarte ${campaign.id}:`, error instanceof Error ? error.stack : String(error))
      }
    }

    if (started || ending) {
      this.logger.log(`Aviso de encarte: ${started} inicio(s), ${ending} fim proximo.`)
    }

    return { started, ending }
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
    const campaigns = await this.prisma.promotionCampaign.findMany({
      where: {
        active: true,
        startDate: { lte: now },
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

    return campaigns.map((campaign) => this.mapCampaignForStorefront(campaign))
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
    if (!campaign || !campaign.active || !isWithinBusinessWindow(campaign.startDate, campaign.endDate, new Date())) {
      return null
    }
    return this.mapCampaignForStorefront(campaign)
  }

  private mapCampaignForStorefront(campaign: {
    id: string
    name: string
    slug: string
    type: string
    bannerUrl: string | null
    startDate: Date
    endDate: Date
    highlightInHome: boolean
    items: Array<{ product: unknown; regularPrice: unknown; promotionalPrice: unknown; discountPercent: unknown }>
  }) {
    return {
      id: campaign.id,
      name: campaign.name,
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
