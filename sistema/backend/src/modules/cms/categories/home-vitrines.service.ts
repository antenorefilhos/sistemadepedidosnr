import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AntenorApiService } from '../../integrations/antenor-api.service';
import { isProductSellable } from '../../../common/product-availability';
import { DEPARTMENT_TO_CATEGORY } from '../../products/products.service';

/** Abaixo disso a prateleira fica rala demais pra exibir (mesmo criterio de JON-172, useHomeShelves.ts). */
const MIN_SHELF_ITEMS = 4;

// TABACARIA nao e oferecida automaticamente em vitrine -- so aparece se o
// cliente buscar ou clicar a categoria explicitamente (Jonathan, 22/09/2026).
function isAutoSurfaceable(produto: { category?: string | null; active?: boolean | null; syncOption?: string | null; stock?: unknown }) {
  return produto.category !== 'TABACARIA' && isProductSellable(produto);
}

// 25/09/2026: a AntenorApi aplica tag de ocasiao por PALAVRA NO NOME, nao
// pelo que o produto e -- "Carvao" vira churrasco (creme dental Colgate
// Carvao), "Queijo/Requeijao" vira adega-e-queijos (Cheetos, empanado),
// "Aveia" vira integral (sabonete). Vitrine de tag so aceita produto dos
// departamentos que fazem sentido pra ela (classification01, que vem do
// cadastro mercadologico, nao do nome). Tag fora do mapa: pelo menos nunca
// mostra higiene/limpeza/tabacaria numa vitrine de ocasiao de comida.
const DEPTS_ADEGA_QUEIJOS = ['BEBIDAS & ADEGA', 'QUEIJOS, FRIOS'];
const TAG_ALLOWED_DEPARTMENTS: Record<string, string[]> = {
  'adega-e-queijos': DEPTS_ADEGA_QUEIJOS,
  'queijos-e-vinhos': DEPTS_ADEGA_QUEIJOS,
  churrasco: ['CARNES', 'MERCEARIA', 'BEBIDAS', 'QUEIJOS'],
  'linha-economica': ['MERCEARIA', 'CAFÉ DA MANHÃ', 'QUEIJOS', 'LIMPEZA', 'HIGIENE', 'PADARIA', 'HORTIFRUTI'],
  'cafe-da-manha': ['CAFÉ DA MANHÃ', 'PADARIA', 'QUEIJOS', 'BISCOITOS', 'HORTIFRUTI'],
  sobremesa: ['BISCOITOS', 'PADARIA', 'CAFÉ DA MANHÃ', 'QUEIJOS', 'CONGELADOS', 'MUNDO SAUDÁVEL'],
  'boteco-em-casa': ['BISCOITOS', 'MERCEARIA', 'BEBIDAS', 'QUEIJOS', 'CARNES', 'CONGELADOS', 'PADARIA'],
  'lanche-rapido': ['BISCOITOS', 'BEBIDAS', 'PADARIA', 'QUEIJOS', 'CONGELADOS'],
};
const NON_FOOD_DEPARTMENTS = ['HIGIENE', 'LIMPEZA', 'TABACARIA'];

export function fitsTagShelf(tag: string, classification01?: string | null): boolean {
  const depto = (classification01 || '').toUpperCase();
  const allowed = TAG_ALLOWED_DEPARTMENTS[tag];
  if (allowed) return allowed.some((d) => depto.includes(d));
  return !NON_FOOD_DEPARTMENTS.some((d) => depto.includes(d));
}

// JON-198 (reaberto 22/09/2026): "Ver mais" caia sempre no /mercado generico
// pra carrossel tipoFiltro='departamento'/'categoria' -- so 'tag' tinha link
// calculado, e no frontend (que nao tem DEPARTMENT_TO_CATEGORY). Resolvido
// aqui, que ja tem o mapeamento, e devolvido pronto pro cliente so usar.
function buildLinkVerTudo(tipoFiltro?: string, valorFiltro?: string): string {
  if (!tipoFiltro || !valorFiltro) return '/mercado';
  if (tipoFiltro === 'tag') return `/mercado?tag=${encodeURIComponent(valorFiltro)}`;
  if (tipoFiltro === 'departamento') {
    const categoria = DEPARTMENT_TO_CATEGORY[valorFiltro];
    if (categoria) return `/mercado?cat=${encodeURIComponent(categoria)}`;
    // 23/09/2026: "Bebidas & Adega" (e qualquer departamento sem 1:1 com
    // nosso enum de categoria -- o departamento cobre 4 categorias nossas
    // distintas: cerveja, vinho, destilado, suco) caia no /mercado generico.
    // classification01 e mais grosso que o enum mas ainda filtra por
    // departamento de verdade, em vez de mostrar a loja inteira.
    return `/mercado?classification01=${encodeURIComponent(valorFiltro)}`;
  }
  if (tipoFiltro === 'categoria') {
    // classification02 no banco vem com prefixo numerico ("02 - BOVINOS"),
    // valorFiltro vem so o nome ("Bovinos") -- buildPrismaWhere/Meili tratam
    // esse parametro com match parcial (case-insensitive) por causa disso.
    return `/mercado?classification02=${encodeURIComponent(valorFiltro)}`;
  }
  return '/mercado';
}

// JON-202 (22/09/2026): a AntenorApi manda um numero FIXO de produtos por
// carrossel -- quando boa parte deles nao e vendavel no nosso catalogo
// (syncOption=NUNCA, comum em hortifruti), a vitrine encolhia sem nenhum
// reforço. Backfill busca mais candidatos do NOSSO catalogo pra fechar esse
// alvo, na mesma categoria/tag do carrossel.
//
// 23/09/2026: subido de 12 pra 30 (a pedido do Jonathan, confirmado direto
// -- a AntenorApi tambem ampliou o pool deles pra 30 na v1.20.4 pra isso) --
// pool maior pro shuffle da Home ter mais produtos diferentes pra sortear
// a cada visita, nao so os mesmos 12 sempre.
const TARGET_POOL_SIZE = 30;

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
  classification01: true,
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
    const carrosseisResolvidos = [];
    for (const carrossel of remota.carrosseis) {
      const produtosResolvidos = carrossel.produtos
        .map((item) => porErpId.get(item.id))
        .filter((produto): produto is NonNullable<typeof produto> => !!produto)
        .filter((produto) => isAutoSurfaceable(produto))
        .filter((produto) => carrossel.tipoFiltro !== 'tag' || !carrossel.valorFiltro || fitsTagShelf(carrossel.valorFiltro, produto.classification01))
        .filter((produto) => {
          if (jaUsados.has(produto.id)) return false;
          jaUsados.add(produto.id);
          return true;
        });

      // 23/09/2026: o gate exigia >=MIN_SHELF_ITEMS ANTES do reforco --
      // carrossel que resolvia a zero localmente (ex.: Carnes com erpProductId
      // que ainda nao bate no nosso catalogo) nunca tentava reforcar e era
      // descartado, mesmo havendo dezenas de candidatos sellable na mesma
      // categoria. O minimo final ja e garantido pelo filter logo abaixo do
      // loop -- aqui so falta checar se ha espaco pra reforcar (< alvo).
      if (produtosResolvidos.length < TARGET_POOL_SIZE) {
        const faltam = TARGET_POOL_SIZE - produtosResolvidos.length;
        const categoryCode =
          carrossel.tipoFiltro === 'departamento' && carrossel.valorFiltro
            ? DEPARTMENT_TO_CATEGORY[carrossel.valorFiltro]
            : undefined;
        const tagFiltro = carrossel.tipoFiltro === 'tag' ? carrossel.valorFiltro : undefined;
        // 22/09/2026: tipoFiltro='categoria' (ex.: "Carnes para o Dia a Dia",
        // valorFiltro='Bovinos') nunca tinha backfill -- so 'departamento' e
        // 'tag' eram tratados, entao essa vitrine ficava presa nos poucos
        // produtos que sobravam depois do filtro de sellability (achado com
        // 5/12). classification02 no banco vem com prefixo numerico
        // ("02 - BOVINOS"), por isso contains em vez de igualdade exata --
        // mesmo criterio do buildLinkVerTudo/buildPrismaWhere.
        const classification02Filtro = carrossel.tipoFiltro === 'categoria' ? carrossel.valorFiltro : undefined;

        if (categoryCode || tagFiltro || classification02Filtro) {
          const reforco = await this.prisma.product.findMany({
            where: {
              id: { notIn: Array.from(jaUsados) },
              active: true,
              ...(categoryCode ? { category: categoryCode } : {}),
              ...(tagFiltro ? { tags: { has: tagFiltro } } : {}),
              ...(classification02Filtro ? { classification02: { contains: classification02Filtro, mode: 'insensitive' } } : {}),
            },
            select: PRODUCT_SELECT,
            take: faltam * 3, // folga pra sobrar apos o filtro de isProductSellable
          });
          for (const produto of reforco) {
            if (produtosResolvidos.length >= TARGET_POOL_SIZE) break;
            if (jaUsados.has(produto.id) || !isAutoSurfaceable(produto)) continue;
            if (tagFiltro && !fitsTagShelf(tagFiltro, produto.classification01)) continue;
            jaUsados.add(produto.id);
            produtosResolvidos.push(produto);
          }
        }
      }

      carrosseisResolvidos.push({
        id: carrossel.id,
        titulo: carrossel.titulo,
        subtitulo: carrossel.subtitulo,
        tipoFiltro: carrossel.tipoFiltro,
        valorFiltro: carrossel.valorFiltro,
        linkVerTudo: buildLinkVerTudo(carrossel.tipoFiltro, carrossel.valorFiltro),
        produtos: produtosResolvidos,
      });
    }
    const carrosseis = carrosseisResolvidos.filter((carrossel) => carrossel.produtos.length >= MIN_SHELF_ITEMS);

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
