import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AntenorApiService } from '../../integrations/antenor-api.service';
import { isProductSellable } from '../../../common/product-availability';

/** Abaixo disso a prateleira fica rala demais pra exibir (mesmo criterio de JON-172, useHomeShelves.ts). */
const MIN_SHELF_ITEMS = 4;

const PRODUCT_SELECT = {
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
  erpProductId: true,
} as const;

export type HomeVitrinesQuery = {
  perfil?: 'condominio' | 'bairro';
  momento?: 'semana' | 'fim_de_semana';
  mes?: number;
  limitePorCarrossel?: number;
};

/**
 * Vitrines Inteligentes (JON-172/173 -> AEF-037): a personalidade contextual
 * (dia da semana/perfil/sazonalidade) e a deduplicacao cross-carrossel vem da
 * AntenorApi -- ela decide QUAIS produtos e EM QUE ORDEM. Preco, foto e
 * estoque exibidos sao SEMPRE os nossos (o motivo esta em antenor-api.service.ts,
 * getVitrines): o catalogo deles pode incluir item que ainda nao sincronizamos,
 * entao cada carrossel e resolvido contra o NOSSO Product por erpProductId e
 * filtrado por isProductSellable -- a mesma regra da vitrine normal.
 */
@Injectable()
export class HomeVitrinesService {
  private readonly logger = new Logger(HomeVitrinesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly antenorApi: AntenorApiService,
  ) {}

  async getHomeVitrines(query: HomeVitrinesQuery) {
    const remota = await this.antenorApi.getVitrines(query);

    const erpIds = Array.from(
      new Set(remota.carrosseis.flatMap((c) => c.produtos.map((p) => p.id))),
    );

    const produtos = await this.prisma.product.findMany({
      where: { erpProductId: { in: erpIds } },
      select: PRODUCT_SELECT,
    });

    // erpProductId nao e @unique (um produto pode ter varias linhas de EAN no
    // ERP) -- na duvida entre duas linhas do mesmo erpProductId, fica a
    // primeira ativa.
    const porErpId = new Map<number, typeof produtos[number]>();
    for (const produto of produtos) {
      if (produto.erpProductId == null) continue;
      const atual = porErpId.get(produto.erpProductId);
      if (!atual || (!atual.active && produto.active)) {
        porErpId.set(produto.erpProductId, produto);
      }
    }

    const jaUsados = new Set<string>();
    const carrosseis = remota.carrosseis
      .map((carrossel) => {
        const produtosResolvidos = carrossel.produtos
          .map((item) => porErpId.get(item.id))
          .filter((produto): produto is NonNullable<typeof produto> => !!produto)
          .filter((produto) => isProductSellable(produto))
          .filter((produto) => {
            if (jaUsados.has(produto.id)) return false;
            jaUsados.add(produto.id);
            return true;
          });

        return {
          id: carrossel.id,
          titulo: carrossel.titulo,
          subtitulo: carrossel.subtitulo,
          produtos: produtosResolvidos,
        };
      })
      .filter((carrossel) => carrossel.produtos.length >= MIN_SHELF_ITEMS);

    const descartados = remota.carrosseis.length - carrosseis.length;
    if (descartados > 0) {
      this.logger.warn(
        `home_vitrines_carrosseis_descartados count=${descartados} motivo=abaixo_do_minimo_apos_resolver_catalogo_local`,
      );
    }

    return {
      contexto: remota.contexto,
      personalidadeAtiva: remota.personalidadeAtiva,
      carrosseis,
    };
  }
}
