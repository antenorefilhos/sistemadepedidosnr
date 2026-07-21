import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';

const DEFAULT_PROMO_BANNERS = [
  {
    title: 'Cortes Selecionados Antenor',
    badge: 'Churrasco da semana',
    description: 'Carne que faz diferenca. Da nossa selecao direto para o seu churrasco sair do jeito certo.',
    imageUrl: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?auto=format&fit=crop&w=1600&q=80',
    ctaLabel: 'Ver cortes',
    ctaTo: '/busca?q=churrasco',
    align: 'left',
    active: true,
  },
  {
    title: 'Prontos para Aquecer',
    badge: 'Pra hoje',
    description: 'Bateu a fome? Aqui voce encontra lanches e pizzas para resolver rapido e bem.',
    imageUrl: 'https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=1600&q=80',
    ctaLabel: 'Ver opcoes',
    ctaTo: '/busca?q=consumo%20rapido',
    align: 'left',
    active: true,
  },
  {
    title: 'Doces Momentos',
    badge: 'Pra beliscar',
    description: 'Doces, chocolates e snacks para completar a compra com aquele agrado que sempre cai bem.',
    imageUrl: 'https://images.unsplash.com/photo-1481391032119-d89fee407e44?auto=format&fit=crop&w=1600&q=80',
    ctaLabel: 'Aproveitar',
    ctaTo: '/busca?q=guloseimas',
    align: 'right',
    active: true,
  },
];

@Injectable()
export class PromoBannersService {
  constructor(private prisma: PrismaService) {}

  private normalizeOptionalId(value?: string | null) {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private toCollectionContract<T extends {
    badge?: string | null;
    ctaTo?: string | null;
  }>(item: T) {
    return {
      ...item,
      subtitle: item.badge ?? null,
      link: item.ctaTo ?? null,
    };
  }

  private async ensureDefaultData() {
    const existing = await this.prisma.promoBanner.findMany({
      select: { title: true, order: true },
      orderBy: { order: 'asc' },
    });

    const existingTitles = new Set(existing.map(item => item.title));
    const maxOrder = existing.length ? Math.max(...existing.map(item => item.order)) : -1;

    const missing = DEFAULT_PROMO_BANNERS.filter(item => !existingTitles.has(item.title)).map((item, index) => ({
      ...item,
      order: maxOrder + index + 1,
    }));

    if (missing.length > 0) {
      await this.prisma.promoBanner.createMany({ data: missing });
    }
  }

  async findAll() {
    await this.ensureDefaultData();
    const rows = await this.prisma.promoBanner.findMany({
      include: {
        highlightedProduct: {
          select: {
            id: true,
            ean: true,
            name: true,
            alternativeDescription: true,
            price: true,
            promotionalPrice: true,
            stock: true,
            isFractional: true,
            fractionStep: true,
            unit: true,
            badges: true,
            titleMask: true,
            titleMaskShort: true,
            syncOption: true,
            category: true,
            origin: true,
            active: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    return rows.map((item) => this.toCollectionContract(item));
  }

  async findActive() {
    await this.ensureDefaultData();
    const rows = await this.prisma.promoBanner.findMany({
      where: { active: true },
      include: {
        highlightedProduct: {
          select: {
            id: true,
            ean: true,
            name: true,
            alternativeDescription: true,
            price: true,
            promotionalPrice: true,
            stock: true,
            isFractional: true,
            fractionStep: true,
            unit: true,
            badges: true,
            titleMask: true,
            titleMaskShort: true,
            syncOption: true,
            category: true,
            origin: true,
            active: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    return rows.map((item) => this.toCollectionContract(item));
  }

  create(data: {
    title: string;
    subtitle?: string;
    link?: string;
    badge?: string;
    highlightNote?: string;
    highlightedProductId?: string;
    description?: string;
    imageUrl: string;
    ctaLabel?: string;
    ctaTo?: string;
    align?: string;
    order?: number;
  }) {
    return this.prisma.promoBanner.create({
      data: {
        ...data,
        badge: data.subtitle ?? data.badge,
        ctaTo: data.link ?? data.ctaTo,
        highlightNote: data.highlightNote,
        highlightedProductId: this.normalizeOptionalId(data.highlightedProductId),
      },
    });
  }

  update(
    id: string,
    data: {
      title?: string;
      subtitle?: string;
      link?: string;
      badge?: string;
      highlightNote?: string;
      highlightedProductId?: string;
      description?: string;
      imageUrl?: string;
      ctaLabel?: string;
      ctaTo?: string;
      align?: string;
      active?: boolean;
      order?: number;
    },
  ) {
    const { subtitle, link, highlightedProductId, ...rest } = data;
    return this.prisma.promoBanner.update({
      where: { id },
      data: {
        ...rest,
        ...(subtitle !== undefined ? { badge: subtitle } : {}),
        ...(link !== undefined ? { ctaTo: link } : {}),
        ...(highlightedProductId !== undefined ? { highlightedProductId: this.normalizeOptionalId(highlightedProductId) } : {}),
      },
    });
  }

  remove(id: string) {
    return this.prisma.promoBanner.delete({ where: { id } });
  }
}
