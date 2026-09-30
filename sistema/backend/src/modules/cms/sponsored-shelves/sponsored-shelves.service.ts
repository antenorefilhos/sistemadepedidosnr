import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { isProductSellable } from '../../../common/product-availability';
import { STOREFRONT_PRODUCT_SELECT, toCustomerFacingProduct } from '../categories/categories.service';

type PricingContext = { tenantId?: string; storeId?: string };

/**
 * Data da vigencia (30/09/2026). A tela manda so o dia ('2026-10-05'); lido
 * como meia-noite UTC, a vitrine entrava as 21h da vespera e saia as 21h do
 * dia anterior ao fim. Dia puro vira o dia inteiro em Brasilia.
 */
export function parseShelfDate(value: string | null | undefined, edge: 'start' | 'end'): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T${edge === 'start' ? '00:00:00' : '23:59:59.999'}-03:00`);
  return new Date(value);
}

/** Por que o produto nao aparece na vitrine -- a loja filtra calada, o admin precisa saber. */
export function hiddenReason(product: { active?: boolean | null; syncOption?: string | null; stock?: unknown; category?: string | null }): string | null {
  if (product.category === 'TABACARIA') return 'Tabacaria não sai em vitrine';
  if (product.active === false) return 'Oculto no site';
  if (product.syncOption === 'NUNCA') return 'Marcado para não vender online no ERP';
  if (!isProductSellable(product)) return 'Sem estoque';
  return null;
}

type Money = { orders: number; units: number; revenue: number };

/**
 * JON-204 (22/09/2026): vitrine de fornecedor/parceria cadastrada direto no
 * admin -- PromotionCampaign (encarte) so existe via sync do ERP, sem
 * criacao manual, entao nao servia pra isso.
 */
@Injectable()
export class SponsoredShelvesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Admin: cada vitrine com o motivo de produto escondido e o relatorio pro
   * fornecedor -- vezes vista, postos no carrinho pela vitrine (e quantos
   * viraram pedido em 24h, mesmo aparelho) e as vendas dos produtos no
   * periodo contra o periodo anterior do mesmo tamanho.
   */
  async listAdmin(context?: PricingContext) {
    const tenantId = context?.tenantId || 'tenant_default';
    const shelves = await this.prisma.sponsoredShelf.findMany({
      where: { tenantId },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { product: { select: STOREFRONT_PRODUCT_SELECT } },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
    const now = new Date();
    const clicks = await this.prisma.$queryRaw<Array<{ shelf: string; adds: number; orders: number; revenue: number }>>`
      WITH adds AS (
        SELECT metadata::jsonb->>'shelf' AS shelf, "deviceId", "entityId" AS product, "createdAt"
        FROM analytics_events
        WHERE type = 'ADD_TO_CART' AND metadata LIKE '{%' AND metadata::jsonb->>'shelf' LIKE 'patrocinada:%'
      ),
      conv AS (
        SELECT DISTINCT a.shelf, o.id AS order_id, i."productId", i.subtotal
        FROM adds a
        JOIN orders o ON o."deviceId" = a."deviceId" AND o."createdAt" BETWEEN a."createdAt" AND a."createdAt" + interval '1 day'
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
        JOIN order_items i ON i."orderId" = o.id AND i."productId" = a.product
      )
      SELECT a.shelf, COUNT(*)::int AS adds,
        COALESCE((SELECT COUNT(DISTINCT c.order_id) FROM conv c WHERE c.shelf = a.shelf), 0)::int AS orders,
        COALESCE((SELECT SUM(c.subtotal) FROM conv c WHERE c.shelf = a.shelf), 0)::float AS revenue
      FROM adds a GROUP BY a.shelf`;
    const byShelf = new Map(clicks.map((c) => [c.shelf, c]));

    const result = [];
    for (const shelf of shelves) {
      const productIds = shelf.items.map((i) => i.productId);
      const start = shelf.startDate ?? new Date(now.getTime() - 30 * 86_400_000);
      const end = shelf.endDate && shelf.endDate < now ? shelf.endDate : now;
      const scheduled = start > now;
      const span = Math.max(86_400_000, end.getTime() - start.getTime());
      const sales = scheduled || productIds.length === 0
        ? null
        : {
            from: start,
            to: end,
            current: await this.sales(productIds, start, end),
            previous: await this.sales(productIds, new Date(start.getTime() - span), start),
          };
      const c = byShelf.get(`patrocinada:${shelf.id}`);
      result.push({
        ...shelf,
        items: shelf.items.map((item) => ({ ...item, hiddenReason: hiddenReason(item.product) })),
        report: {
          impressions: shelf.impressionsCount,
          adds: Number(c?.adds || 0),
          orders: Number(c?.orders || 0),
          revenue: Math.round(Number(c?.revenue || 0) * 100) / 100,
          sales,
        },
      });
    }
    return result;
  }

  private async sales(productIds: string[], from: Date, to: Date): Promise<Money> {
    const [row] = await this.prisma.$queryRaw<Array<{ orders: number; units: number; revenue: number }>>`
      SELECT COUNT(DISTINCT o.id)::int AS orders, COALESCE(SUM(i.quantity), 0)::float AS units, COALESCE(SUM(i.subtotal), 0)::float AS revenue
      FROM order_items i JOIN orders o ON o.id = i."orderId"
      WHERE i."productId" = ANY(${productIds}) AND o.status NOT IN ('CANCELLED', 'REFUNDED')
        AND o."createdAt" >= ${from} AND o."createdAt" < ${to}`;
    return { orders: Number(row?.orders || 0), units: Math.round(Number(row?.units || 0) * 1000) / 1000, revenue: Math.round(Number(row?.revenue || 0) * 100) / 100 };
  }

  async registerImpression(id: string): Promise<void> {
    await this.prisma.sponsoredShelf.update({ where: { id }, data: { impressionsCount: { increment: 1 } } }).catch(() => undefined);
  }

  async create(context: PricingContext | undefined, body: { title: string; sponsorName?: string; active?: boolean; priority?: number; startDate?: string | null; endDate?: string | null; productIds?: string[] }) {
    const tenantId = context?.tenantId || 'tenant_default';
    const storeId = context?.storeId || 'store_default';
    const title = String(body.title || '').trim();
    if (!title) throw new BadRequestException('Titulo e obrigatorio.');
    const startDate = parseShelfDate(body.startDate, 'start');
    const endDate = parseShelfDate(body.endDate, 'end');
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

    const startDate = body.startDate !== undefined ? parseShelfDate(body.startDate, 'start') : shelf.startDate;
    const endDate = body.endDate !== undefined ? parseShelfDate(body.endDate, 'end') : shelf.endDate;
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
          .filter((product) => hiddenReason(product) === null)
          .map(toCustomerFacingProduct),
      }))
      .filter((shelf) => shelf.products.length > 0);
  }
}
