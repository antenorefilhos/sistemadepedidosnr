import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';

const COMMERCIAL_CATEGORY_PRIORITY = [
  'CARNES_DIA_A_DIA',
  'CHURRASCO',
  'HORTIFRUTI',
  'PADARIA',
  'LATICINIOS',
  'MERCEARIA',
  'BEBIDAS',
  'CERVEJAS',
  'VINHOS',
  'CONGELADOS',
  'CONSUMO_RAPIDO',
  'GULOSEIMAS',
  'LIMPEZA',
  'HIGIENE_PESSOAL',
  'PERFUMARIA',
  'BEBE',
  'PET_SHOP',
  'UTILIDADES',
  'ESPACO_GOURMET',
  'SERVICO',
  'PATRIMONIAL',
  'NAO_CLASSIFICADO',
  'GERAL',
];

const normalizeCategoryCode = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const categoryPriorityIndex = (name: string) => {
  const normalized = normalizeCategoryCode(name);
  const index = COMMERCIAL_CATEGORY_PRIORITY.indexOf(normalized);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
};

const CMS_CATEGORY_LABELS: Record<string, string> = {
  CHURRASCO: 'Churrasco',
  CARNES_DIA_A_DIA: 'Carnes Dia a Dia',
  PADARIA: 'Padaria',
  CONSUMO_RAPIDO: 'Consumo Rapido',
  GULOSEIMAS: 'Guloseimas',
  BEBIDAS: 'Bebidas',
  VINHOS: 'Vinhos',
  CERVEJAS: 'Cervejas',
  MERCEARIA: 'Mercearia',
  LATICINIOS: 'Laticinios',
  UTILIDADES: 'Utilidades',
  CONGELADOS: 'Congelados',
  PET_SHOP: 'Pet Shop',
  BEBE: 'Bebe',
  HORTIFRUTI: 'Hortifruti',
  LIMPEZA: 'Limpeza',
  HIGIENE_PESSOAL: 'Higiene Pessoal',
  PERFUMARIA: 'Perfumaria',
  ESPACO_GOURMET: 'Espaco Gourmet',
  SERVICO: 'Servico',
  PATRIMONIAL: 'Patrimonial',
  NAO_CLASSIFICADO: 'Nao Classificado',
};

const toDisplayLabel = (code: string) => {
  if (CMS_CATEGORY_LABELS[code]) return CMS_CATEGORY_LABELS[code];
  return code
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  private normalizeCuratedIds(ids?: string[]) {
    if (!Array.isArray(ids)) return [];
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const id of ids) {
      const value = String(id || '').trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      cleaned.push(value);
    }
    return cleaned;
  }

  private async toValidCuratedIds(ids?: string[]) {
    const normalized = this.normalizeCuratedIds(ids);
    if (normalized.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: normalized } },
      select: { id: true },
    });

    const valid = new Set(products.map((p) => p.id));
    return normalized.filter((id) => valid.has(id));
  }

  private async replaceCategoryCurations(categoryId: string, curatedProductIds?: string[]) {
    if (!Array.isArray(curatedProductIds)) return;

    const validIds = await this.toValidCuratedIds(curatedProductIds);

    await this.prisma.categoryProductCuration.deleteMany({
      where: { categoryId },
    });

    if (validIds.length === 0) return;

    await this.prisma.categoryProductCuration.createMany({
      data: validIds.map((productId, index) => ({
        categoryId,
        productId,
        order: index,
      })),
      skipDuplicates: true,
    });
  }

  async findAll() {
    const categories = await this.prisma.category.findMany({
      include: {
        curatedProducts: {
          orderBy: { order: 'asc' },
          include: {
            product: {
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
        },
      },
    });

    const mapped = categories.map((category) => ({
      ...category,
      curatedProductIds: category.curatedProducts.map((item) => item.productId),
      curatedProducts: category.curatedProducts.map((item) => item.product),
    }));

    return mapped.sort((a, b) => {
      // Sort by priority (ascending, 0 is highest)
      if (a.priority !== b.priority) return a.priority - b.priority;

      // Then by active status (active first)
      if (a.active !== b.active) return a.active ? -1 : 1;

      // Finally by commercial priority and name
      const priorityDiff = categoryPriorityIndex(a.name) - categoryPriorityIndex(b.name);
      if (priorityDiff !== 0) return priorityDiff;

      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }

  async findCommercialTaxonomy() {
    const [categories, products] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        include: {
          classificationMappings: {
            select: {
              classificationLevel: true,
              classificationValue: true,
            },
          },
          curatedProducts: {
            orderBy: { order: 'asc' },
            include: {
              product: {
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
          },
        },
      }),
      this.prisma.product.findMany({
        where: {
          active: true,
        },
        select: {
          category: true,
          classification01: true,
          classification02: true,
          classification03: true,
          classification04: true,
          syncOption: true,
          stock: true,
        },
      }),
    ]);

    const countsByCode = new Map<string, number>();
    for (const item of products) {
      const code = normalizeCategoryCode(item.category || 'NAO_CLASSIFICADO');
      countsByCode.set(code, (countsByCode.get(code) || 0) + 1);
    }

    const byCode = new Map<string, {
      id?: string;
      code: string;
      name: string;
      active: boolean;
      priority: number;
      limit: number;
      bannerUrl?: string | null;
      productCount: number;
      curatedProductIds: string[];
      curatedProducts: Array<{
        id: string;
        ean: string;
        name: string;
        alternativeDescription: string | null;
        price: number;
        promotionalPrice: number | null;
        stock: number | null;
        isFractional: boolean;
        fractionStep: number | null;
        unit: string;
        badges: string | null;
        titleMask: string | null;
        titleMaskShort: string | null;
        syncOption: string;
        category: string;
        origin: string | null;
        active: boolean;
      }>;
      source: 'cms' | 'fallback';
    }>();

    const isEligibleForStorefront = (product: {
      syncOption: string | null;
      stock: number | null;
    }) => {
      if (product.syncOption === 'NUNCA') return false;
      if (product.syncOption === 'SEMPRE') return true;
      return Number(product.stock || 0) > 0;
    };

    const countProductsForMappings = (
      mappings: Array<{ classificationLevel: number; classificationValue: string }>
    ) => {
      if (!mappings || mappings.length === 0) return 0;

      return products.reduce((acc, product) => {
        if (!isEligibleForStorefront(product)) return acc;

        const matched = mappings.some((mapping) => {
          if (mapping.classificationLevel === 1) return product.classification01 === mapping.classificationValue;
          if (mapping.classificationLevel === 2) return product.classification02 === mapping.classificationValue;
          if (mapping.classificationLevel === 3) return product.classification03 === mapping.classificationValue;
          if (mapping.classificationLevel === 4) return product.classification04 === mapping.classificationValue;
          return false;
        });

        return matched ? acc + 1 : acc;
      }, 0);
    };

    for (const category of categories) {
      const code = normalizeCategoryCode(category.name);
      const mappingBasedCount = countProductsForMappings(category.classificationMappings as Array<{ classificationLevel: number; classificationValue: string }>);
      byCode.set(code, {
        id: category.id,
        code,
        name: category.name,
        active: category.active,
        priority: category.priority,
        limit: category.limit,
        bannerUrl: category.bannerUrl,
        productCount: mappingBasedCount,
        curatedProductIds: category.curatedProducts.map((item) => item.productId),
        curatedProducts: category.curatedProducts.map((item) => item.product),
        source: 'cms',
      });
    }

    for (const [code, productCount] of countsByCode.entries()) {
      if (byCode.has(code)) continue;
      byCode.set(code, {
        code,
        name: toDisplayLabel(code),
        active: false,
        priority: 999,
        limit: 6,
        bannerUrl: null,
        productCount,
        curatedProductIds: [],
        curatedProducts: [],
        source: 'fallback',
      });
    }

    return [...byCode.values()].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.active !== b.active) return a.active ? -1 : 1;
      const priorityDiff = categoryPriorityIndex(a.code) - categoryPriorityIndex(b.code);
      if (priorityDiff !== 0) return priorityDiff;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }

  async create(data: { name: string; bannerUrl?: string; priority?: number; limit?: number; curatedProductIds?: string[] }) {
    const { curatedProductIds, ...categoryData } = data;

    const created = await this.prisma.category.create({
      data: categoryData,
    });

    await this.replaceCategoryCurations(created.id, curatedProductIds);

    return this.prisma.category.findUnique({
      where: { id: created.id },
      include: {
        curatedProducts: {
          orderBy: { order: 'asc' },
          include: { product: true },
        },
      },
    });
  }

  async update(id: string, data: { name?: string; bannerUrl?: string; active?: boolean; priority?: number; limit?: number; curatedProductIds?: string[] }) {
    const { curatedProductIds, ...categoryData } = data;

    await this.prisma.category.update({
      where: { id },
      data: categoryData,
    });

    await this.replaceCategoryCurations(id, curatedProductIds);

    return this.prisma.category.findUnique({
      where: { id },
      include: {
        curatedProducts: {
          orderBy: { order: 'asc' },
          include: { product: true },
        },
      },
    });
  }

  remove(id: string) {
    return this.prisma.category.delete({
      where: { id },
    });
  }

  // ─── Mapeamento Manual de Classificações ─────────────────────────────────

  async getClassificationMappings() {
    // Busca todas as classificações distintas dos produtos ativos
    const products = await this.prisma.product.findMany({
      where: { active: true },
      select: {
        classification01: true,
        classification02: true,
        classification03: true,
        classification04: true,
      },
    });

    const allClassifications: { level: number; value: string }[] = [];
    const seen = new Set<string>();

    for (const p of products) {
      const entries: [number, string | null | undefined][] = [
        [1, p.classification01],
        [2, p.classification02],
        [3, p.classification03],
        [4, p.classification04],
      ];
      for (const [level, value] of entries) {
        if (!value?.trim()) continue;
        const key = `${level}::${value.trim()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allClassifications.push({ level, value: value.trim() });
      }
    }

    allClassifications.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.value.localeCompare(b.value, 'pt-BR');
    });

    // Busca todos os mapeamentos existentes
    const mappings = await this.prisma.categoryClassificationMapping.findMany({
      include: { category: { select: { id: true, name: true } } },
    });

    // Quais classification keys já foram mapeadas
    const mappedKeys = new Set(
      mappings.map((m) => `${m.classificationLevel}::${m.classificationValue}`)
    );

    return {
      classifications: allClassifications.map((c) => ({
        ...c,
        mapped: mappedKeys.has(`${c.level}::${c.value}`),
        categories: mappings
          .filter((m) => m.classificationLevel === c.level && m.classificationValue === c.value)
          .map((m) => ({ mappingId: m.id, categoryId: m.categoryId, categoryName: m.category.name })),
      })),
      mappings,
      unmappedCount: allClassifications.filter((c) => !mappedKeys.has(`${c.level}::${c.value}`)).length,
      totalCount: allClassifications.length,
    };
  }

  async addClassificationMapping(data: { categoryId: string; classificationLevel: number; classificationValue: string }) {
    return this.prisma.categoryClassificationMapping.create({
      data: {
        categoryId: data.categoryId,
        classificationLevel: data.classificationLevel,
        classificationValue: data.classificationValue.trim(),
      },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async removeClassificationMapping(id: string) {
    return this.prisma.categoryClassificationMapping.delete({ where: { id } });
  }

  // Retorna as condições Prisma para filtrar produtos pela categoria usando mapeamentos
  async buildCategoryFilterConditions(categoryCode: string): Promise<Record<string, any> | null> {
    const normCode = categoryCode
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const category = await this.prisma.category.findFirst({
      where: { name: normCode },
      include: { classificationMappings: true },
    });

    if (!category || category.classificationMappings.length === 0) return null;

    const orConditions = category.classificationMappings.map((m) => {
      const field = `classification0${m.classificationLevel}`;
      return { [field]: m.classificationValue };
    });

    return { OR: orConditions };
  }
}
