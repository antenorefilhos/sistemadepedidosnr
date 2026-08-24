import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { SolidcomERPService } from '../integrations/solidcom-erp.service'

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
    private readonly solidcomERPService: SolidcomERPService,
  ) {}

  /**
   * Puxa os encartes/campanhas ativos do ERP (filial Nova Real, flag
   * ecommerce=true) e grava/atualiza PromotionCampaign + itens, aplicando
   * o promotionalPrice no catalogo enquanto a campanha estiver vigente.
   *
   * fetchActivePromotionCampaigns() ainda e um stub (endpoint do Solidcom
   * nao confirmado) -- ver comentario em solidcom-erp.service.ts. Ate la
   * este metodo roda e nao encontra nada pra sincronizar, sem quebrar nada.
   */
  async syncFromERP(): Promise<{ campaignsSynced: number; itemsSynced: number; productsUpdated: number }> {
    const campaigns = await this.solidcomERPService.fetchActivePromotionCampaigns()

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
          startDate: new Date(erpCampaign.startDate),
          endDate: new Date(erpCampaign.endDate),
          active: true,
        },
        update: {
          name: erpCampaign.name,
          startDate: new Date(erpCampaign.startDate),
          endDate: new Date(erpCampaign.endDate),
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

        await this.prisma.product.update({
          where: { id: productId },
          data: { promotionalPrice: item.promotionalPrice },
        })
        productsUpdated += 1
      }
    }

    if (campaigns.length > 0) {
      this.logger.log(
        `Sync de encartes: ${campaigns.length} campanha(s), ${itemsSynced} item(ns), ${productsUpdated} produto(s) com preco atualizado.`,
      )
    }

    return { campaignsSynced: campaigns.length, itemsSynced, productsUpdated }
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

    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      type: campaign.type,
      bannerUrl: campaign.bannerUrl,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      highlightInHome: campaign.highlightInHome,
      items: campaign.items.map((item) => ({
        ...item.product,
        regularPrice: item.regularPrice,
        promotionalPrice: item.promotionalPrice,
        discountPercent: item.discountPercent,
      })),
    }))
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
