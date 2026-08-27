import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface StoreBannerPayload {
  name: string;
  slot?: string;
  targetCategory?: string | null;
  active?: boolean;
  linkType?: string;
  linkValue?: string | null;
  linkTarget?: string;
  title?: string;
  description?: string | null;
  badgeText?: string | null;
  highlightNote?: string | null;
  ctaLabel?: string | null;
  overlayColor?: string | null;
  align?: string;
  sponsorName?: string | null;
  desktopImageUrl: string;
  mobileImageUrl?: string | null;
  pages?: string;
  startDate?: string | null;
  endDate?: string | null;
  campaignErpId?: number | null;
  order?: number;
}

// Enums do StoreBanner sao `String` no schema (sem @@enum no Postgres, ver
// comentario no schema.prisma) -- o unico lugar que garante um valor valido
// e aqui. Um slot/linkType invalido nao quebra nada na hora (Prisma aceita
// qualquer string), mas o banner nunca aparece em lugar nenhum do storefront
// (todo consumidor filtra por igualdade estrita com esses valores) -- silencioso
// e dificil de debugar, por isso valida na entrada em vez de deixar passar.
const VALID_SLOTS = ['hero', 'intercalado', 'category', 'tarja', 'popup'];
const VALID_LINK_TYPES = ['url', 'category', 'product', 'search'];
const VALID_LINK_TARGETS = ['_self', '_blank'];
const VALID_PAGES = ['home', 'all', 'category', 'product'];
const VALID_ALIGN = ['left', 'center', 'right'];

function assertValidEnum(value: string | undefined, allowed: string[], field: string) {
  if (value !== undefined && !allowed.includes(value)) {
    throw new BadRequestException(`${field} inválido: "${value}". Valores aceitos: ${allowed.join(', ')}.`);
  }
}

function validateBannerPayload(data: Partial<StoreBannerPayload>, { isCreate }: { isCreate: boolean }) {
  assertValidEnum(data.slot, VALID_SLOTS, 'slot');
  assertValidEnum(data.linkType, VALID_LINK_TYPES, 'linkType');
  assertValidEnum(data.linkTarget, VALID_LINK_TARGETS, 'linkTarget');
  assertValidEnum(data.pages, VALID_PAGES, 'pages');
  assertValidEnum(data.align, VALID_ALIGN, 'align');
  if (data.slot === 'category' && !data.targetCategory?.trim()) {
    throw new BadRequestException('targetCategory é obrigatório quando slot = "category".');
  }
  // So na criacao: um PATCH parcial que nao toca `name`/`desktopImageUrl`
  // (ex.: so reordenando ou ativando/desativando) nao deve barrar por esses
  // campos estarem "ausentes" do payload -- eles ja existem no registro.
  if (isCreate || data.name !== undefined) {
    if (!data.name?.trim()) throw new BadRequestException('name é obrigatório.');
  }
  if (isCreate || data.desktopImageUrl !== undefined) {
    if (!data.desktopImageUrl?.trim()) throw new BadRequestException('desktopImageUrl é obrigatório.');
  }
}

@Injectable()
export class StoreBannersService {
  private readonly uploadsDir = join(process.cwd(), 'uploads');

  constructor(private readonly prisma: PrismaService) {}

  private extractFilenameFromUrl(url: string): string | null {
    const match = url.match(/\/uploads\/(.+)$/);
    return match ? match[1] : null;
  }

  private async deleteFile(filename: string): Promise<void> {
    if (!filename) return;
    try {
      const filepath = join(this.uploadsDir, filename);
      await fs.unlink(filepath);
    } catch (err) {
      // Arquivo já deletado ou não existe — continuar silenciosamente
      console.warn(`[StoreBanners] Arquivo não encontrado ou já deletado: ${filename}`, err.message);
    }
  }

  // Junta os banners vinculados a encarte (campaignErpId) com a campanha
  // correspondente -- sem FK (ver comentario no schema), entao resolve na
  // mao igual ja fazemos pro produto exaltado. Devolve so os campos uteis
  // pro consumidor do banner (nome, vigencia) e um mapa por erpCampaignId.
  private async resolveCampaigns(banners: { campaignErpId: number | null }[]) {
    const ids = [...new Set(banners.filter((b) => b.campaignErpId != null).map((b) => b.campaignErpId as number))];
    if (ids.length === 0) return new Map<number, { name: string; active: boolean; startDate: Date; endDate: Date }>();
    const campaigns = await this.prisma.promotionCampaign.findMany({ where: { erpCampaignId: { in: ids } } });
    return new Map(campaigns.map((c) => [c.erpCampaignId as number, c]));
  }

  async findActive(filters: { slot?: string; category?: string; page?: string } = {}) {
    const now = new Date();
    const banners = await this.prisma.storeBanner.findMany({
      where: {
        active: true,
        ...(filters.slot ? { slot: filters.slot } : {}),
        ...(filters.category ? { targetCategory: filters.category } : {}),
        ...(filters.page ? { pages: { in: [filters.page, 'all'] } } : {}),
      },
      orderBy: { order: 'asc' },
    });

    const campaignByErpId = await this.resolveCampaigns(banners);

    // Vigencia: banner vinculado a encarte (campaignErpId) segue 100% a
    // campanha depois que ela sincroniza. Antes disso (ou se o encarte
    // nunca chegar a sincronizar), cai no fallback de startDate/endDate
    // proprios do banner -- por isso o admin (StoreBannersManager) so
    // desabilita esses dois campos quando `campaignFound` confirma que a
    // campanha ja existe; enquanto nao existe, eles continuam editaveis e
    // sao o unico controle de vigencia que o usuario tem sobre o banner.
    const visible = banners.filter((banner) => {
      if (banner.campaignErpId != null) {
        const campaign = campaignByErpId.get(banner.campaignErpId);
        if (campaign) {
          return campaign.active && campaign.startDate <= now && campaign.endDate >= now;
        }
      }
      if (banner.startDate && banner.startDate > now) return false;
      if (banner.endDate && banner.endDate < now) return false;
      return true;
    });

    // Resolve o produto exaltado (linkType=product) pra quem consome o
    // banner nao precisar de uma segunda chamada -- equivalente ao
    // PromoBanner.highlightedProduct legado.
    const productIds = visible.filter((b) => b.linkType === 'product' && b.linkValue).map((b) => b.linkValue as string);
    const products = productIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: productIds } } })
      : [];
    const productById = new Map(products.map((p) => [p.id, p]));

    return visible.map((banner) => {
      const campaign = banner.campaignErpId != null ? campaignByErpId.get(banner.campaignErpId) : undefined;
      return {
        ...banner,
        highlightedProduct: banner.linkType === 'product' && banner.linkValue ? productById.get(banner.linkValue) || null : null,
        campaignName: campaign?.name ?? null,
        campaignEndDate: campaign?.endDate ?? null,
      };
    });
  }

  async findAll() {
    const banners = await this.prisma.storeBanner.findMany({ orderBy: { order: 'asc' } });
    const campaignByErpId = await this.resolveCampaigns(banners);
    return banners.map((banner) => {
      const campaign = banner.campaignErpId != null ? campaignByErpId.get(banner.campaignErpId) : undefined;
      return {
        ...banner,
        campaignName: banner.campaignErpId != null ? (campaign?.name ?? null) : null,
        campaignEndDate: banner.campaignErpId != null ? (campaign?.endDate ?? null) : null,
        campaignFound: banner.campaignErpId != null ? Boolean(campaign) : null,
      };
    });
  }

  create(data: StoreBannerPayload) {
    validateBannerPayload(data, { isCreate: true });
    return this.prisma.storeBanner.create({
      data: {
        name: data.name,
        slot: data.slot ?? 'hero',
        targetCategory: data.targetCategory ?? null,
        active: data.active ?? true,
        linkType: data.linkType ?? 'url',
        linkValue: data.linkValue ?? null,
        linkTarget: data.linkTarget ?? '_self',
        title: data.title ?? null,
        description: data.description ?? null,
        badgeText: data.badgeText ?? null,
        highlightNote: data.highlightNote ?? null,
        ctaLabel: data.ctaLabel ?? null,
        overlayColor: data.overlayColor ?? null,
        align: data.align ?? 'left',
        sponsorName: data.sponsorName ?? null,
        desktopImageUrl: data.desktopImageUrl,
        mobileImageUrl: data.mobileImageUrl ?? null,
        pages: data.pages ?? 'home',
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        campaignErpId: data.campaignErpId ?? null,
        order: data.order ?? 0,
      },
    });
  }

  async update(id: string, data: Partial<StoreBannerPayload>) {
    validateBannerPayload(data, { isCreate: false });
    const existing = await this.prisma.storeBanner.findUnique({ where: { id } });
    if (!existing) throw new Error(`Banner não encontrado: ${id}`);

    // Limpar imagem desktop anterior se uma nova for fornecida
    if (data.desktopImageUrl !== undefined && existing.desktopImageUrl !== data.desktopImageUrl) {
      const filename = this.extractFilenameFromUrl(existing.desktopImageUrl);
      if (filename) await this.deleteFile(filename);
    }

    // Limpar imagem mobile anterior se uma nova for fornecida
    if (data.mobileImageUrl !== undefined && existing.mobileImageUrl !== data.mobileImageUrl) {
      const filename = this.extractFilenameFromUrl(existing.mobileImageUrl);
      if (filename) await this.deleteFile(filename);
    }

    return this.prisma.storeBanner.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slot !== undefined && { slot: data.slot }),
        ...(data.targetCategory !== undefined && { targetCategory: data.targetCategory || null }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.linkType !== undefined && { linkType: data.linkType }),
        ...(data.linkValue !== undefined && { linkValue: data.linkValue || null }),
        ...(data.linkTarget !== undefined && { linkTarget: data.linkTarget }),
        ...(data.title !== undefined && { title: data.title || null }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.badgeText !== undefined && { badgeText: data.badgeText || null }),
        ...(data.highlightNote !== undefined && { highlightNote: data.highlightNote || null }),
        ...(data.ctaLabel !== undefined && { ctaLabel: data.ctaLabel || null }),
        ...(data.overlayColor !== undefined && { overlayColor: data.overlayColor || null }),
        ...(data.align !== undefined && { align: data.align }),
        ...(data.sponsorName !== undefined && { sponsorName: data.sponsorName || null }),
        ...(data.desktopImageUrl !== undefined && { desktopImageUrl: data.desktopImageUrl }),
        ...(data.mobileImageUrl !== undefined && { mobileImageUrl: data.mobileImageUrl || null }),
        ...(data.pages !== undefined && { pages: data.pages }),
        ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.campaignErpId !== undefined && { campaignErpId: data.campaignErpId ?? null }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });
  }

  remove(id: string) {
    return this.prisma.storeBanner.delete({ where: { id } });
  }

  async deleteWithCleanup(id: string) {
    const banner = await this.prisma.storeBanner.findUnique({ where: { id } });
    if (!banner) throw new Error(`Banner não encontrado: ${id}`);

    // Limpar arquivos de disco
    if (banner.desktopImageUrl) {
      const filename = this.extractFilenameFromUrl(banner.desktopImageUrl);
      if (filename) await this.deleteFile(filename);
    }

    if (banner.mobileImageUrl) {
      const filename = this.extractFilenameFromUrl(banner.mobileImageUrl);
      if (filename) await this.deleteFile(filename);
    }

    // Deletar do BD
    return this.prisma.storeBanner.delete({ where: { id } });
  }

  // Incrementa de forma "melhor esforco" -- nunca deve derrubar a navegacao
  // do cliente por causa de uma metrica.
  async registerClick(id: string): Promise<void> {
    await this.prisma.storeBanner.update({
      where: { id },
      data: { clicksCount: { increment: 1 } },
    }).catch(() => undefined);
  }

  async registerImpression(id: string): Promise<void> {
    await this.prisma.storeBanner.update({
      where: { id },
      data: { impressionsCount: { increment: 1 } },
    }).catch(() => undefined);
  }
}
