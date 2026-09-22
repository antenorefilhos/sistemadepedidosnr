import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { isProductSellable } from '../../../common/product-availability';
import { STOREFRONT_PRODUCT_SELECT, toCustomerFacingProduct } from '../categories/categories.service';

type PricingContext = { tenantId?: string; storeId?: string };

/**
 * JON-204 (22/09/2026): vitrine de fornecedor/parceria cadastrada direto no
 * admin -- PromotionCampaign (encarte) so existe via sync do ERP, sem
 * criacao manual, entao nao servia pra isso.
 */
@Injectable()
export class SponsoredShelvesService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmin(context?: PricingContext) {
    const tenantId = context?.tenantId || 'tenant_default';
    return this.prisma.sponsoredShelf.findMany({
      where: { tenantId },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { product: { select: STOREFRONT_PRODUCT_SELECT } },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(context: PricingContext | undefined, body: { title: string; sponsorName?: string; active?: boolean; priority?: number; startDate?: string | null; endDate?: string | null; productIds?: string[] }) {
    const tenantId = context?.tenantId || 'tenant_default';
    const storeId = context?.storeId || 'store_default';
    const title = String(body.title || '').trim();
    if (!title) throw new BadRequestException('Titulo e obrigatorio.');
    const startDate = body.startDate ? new Date(body.startDate) : null;
    const endDate = body.endDate ? new Date(body.endDate) : null;
    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException('Data de inicio nao pode ser depois da data de fim.');
    }

    return this.prisma.sponsoredShelf.create({
      data: {
        tenantId,
        storeId,
        title,
        sponsorName: body.sponsorName?.trim() || null,
        active: body.active ?? true,
        priority: Number(body.priority || 0),
        startDate,
        endDate,
        items: {
          create: (body.productIds || []).map((productId, order) => ({ productId, order })),
        },
      },
      include: { items: { include: { product: { select: STOREFRONT_PRODUCT_SELECT } } } },
    });
  }

  async update(id: string, body: { title?: string; sponsorName?: string; active?: boolean; priority?: number; startDate?: string | null; endDate?: string | null; productIds?: string[] }) {
    const shelf = await this.prisma.sponsoredShelf.findUnique({ where: { id } });
    if (!shelf) throw new NotFoundException('Vitrine patrocinada nao encontrada.');

    const startDate = body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : shelf.startDate;
    const endDate = body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : shelf.endDate;
    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException('Data de inicio nao pode ser depois da data de fim.');
    }

    await this.prisma.sponsoredShelf.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
        ...(body.sponsorName !== undefined ? { sponsorName: body.sponsorName?.trim() || null } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.priority !== undefined ? { priority: Number(body.priority) } : {}),
        ...(body.startDate !== undefined ? { startDate } : {}),
        ...(body.endDate !== undefined ? { endDate } : {}),
      },
    });

    // Lista de produtos e sempre substituida por inteiro quando enviada --
    // mais simples e previsivel que diff incremental pra um form de admin
    // que reenvia a lista completa a cada save.
    if (body.productIds !== undefined) {
      await this.prisma.sponsoredShelfItem.deleteMany({ where: { shelfId: id } });
      if (body.productIds.length > 0) {
        await this.prisma.sponsoredShelfItem.createMany({
          data: body.productIds.map((productId, order) => ({ shelfId: id, productId, order })),
        });
      }
    }

    return this.prisma.sponsoredShelf.findUnique({
      where: { id },
      include: { items: { orderBy: { order: 'asc' }, include: { product: { select: STOREFRONT_PRODUCT_SELECT } } } },
    });
  }

  async remove(id: string) {
    const shelf = await this.prisma.sponsoredShelf.findUnique({ where: { id } });
    if (!shelf) throw new NotFoundException('Vitrine patrocinada nao encontrada.');
    await this.prisma.sponsoredShelf.delete({ where: { id } });
    return { success: true };
  }

  /** Publico (storefront): so as ativas, so produtos vendaveis. */
  async listPublic(context?: PricingContext) {
    const tenantId = context?.tenantId || 'tenant_default';
    const storeId = context?.storeId || 'store_default';
    const now = new Date();
    const shelves = await this.prisma.sponsoredShelf.findMany({
      where: {
        tenantId,
        storeId,
        active: true,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { product: { select: STOREFRONT_PRODUCT_SELECT } },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    return shelves
      .map((shelf) => ({
        id: shelf.id,
        title: shelf.title,
        sponsorName: shelf.sponsorName,
        products: shelf.items
          .map((item) => item.product)
          // TABACARIA nao e oferecida automaticamente (Jonathan, 22/09/2026).
          .filter((product) => product.category !== 'TABACARIA' && isProductSellable(product))
          .map(toCustomerFacingProduct),
      }))
      .filter((shelf) => shelf.products.length > 0);
  }
}
