import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AntenorApiService } from '../../integrations/antenor-api.service';
import { isProductSellable } from '../../../common/product-availability';
import { notOfferedCategoryCodes } from '../../../common/not-offered-categories';
import { BEVERAGE_CATEGORIA_TO_CATEGORY, DEPARTMENT_TO_CATEGORY, departmentCategories } from '../../products/products.service';

/** Abaixo disso a prateleira fica rala demais pra exibir (mesmo criterio de JON-172, useHomeShelves.ts). */
const MIN_SHELF_ITEMS = 4;

// TABACARIA e departamento oculto no admin nao sao oferecidos automaticamente
// em vitrine -- so aparecem se o cliente buscar (ver not-offered-categories.ts).
function isAutoSurfaceable(
  produto: { category?: string | null; active?: boolean | null; syncOption?: string | null; stock?: unknown },
  notOffered: Set<string>,
) {
  return !notOffered.has(String(produto.category || '')) && isProductSellable(produto);
}

// 25/09/2026: a AntenorApi aplica tag de ocasiao por PALAVRA NO NOME, nao
// pelo que o produto e -- "Carvao" vira churrasco (creme dental Colgate
// Carvao), "Queijo/Requeijao" vira adega-e-queijos (Cheetos, empanado),
// "Aveia" vira integral (sabonete). Vitrine de tag so aceita produto das
// categorias que fazem sentido pra ela. Usa o nosso `category` (vem do
// departamentoEcommerce), NAO o classification01 do ERP -- esse tambem vem
// por palavra-chave (Cheetos Requeijao esta como "QUEIJOS, FRIOS &
// LATICINIOS" la). Tag fora do mapa: nunca mostra higiene/limpeza/
// tabacaria/pet/bazar numa vitrine de ocasiao de comida.
const TAG_ALLOWED_CATEGORIES: Record<string, string[]> = {
  'adega-e-queijos': ['ADEGA', 'QUEIJOS', 'ESPACO_GOURMET'],
  'queijos-e-vinhos': ['ADEGA', 'QUEIJOS', 'ESPACO_GOURMET'],
  churrasco: ['ACOUGUE', 'MERCEARIA', 'CERVEJAS', 'ADEGA', 'DESTILADOS', 'SUCOS', 'QUEIJOS', 'BAZAR', 'CONGELADOS'],
  'linha-economica': ['MERCEARIA', 'PADARIA', 'QUEIJOS', 'LIMPEZA', 'HIGIENE', 'HORTIFRUTI'],
  'cafe-da-manha': ['PADARIA', 'QUEIJOS', 'DOCES', 'HORTIFRUTI', 'MERCEARIA'],
  sobremesa: ['DOCES', 'PADARIA', 'QUEIJOS', 'CONGELADOS', 'MUNDO_SAUDAVEL'],
  'boteco-em-casa': ['DOCES', 'MERCEARIA', 'CERVEJAS', 'DESTILADOS', 'ADEGA', 'SUCOS', 'QUEIJOS', 'ACOUGUE', 'CONGELADOS', 'PADARIA'],
  'lanche-rapido': ['DOCES', 'SUCOS', 'CERVEJAS', 'PADARIA', 'QUEIJOS', 'CONGELADOS'],
};
const NON_FOOD_CATEGORIES = ['HIGIENE', 'LIMPEZA', 'TABACARIA', 'PET', 'BAZAR'];

export function fitsTagShelf(tag: string, category?: string | null): boolean {
  const cat = (category || '').toUpperCase();
  const allowed = TAG_ALLOWED_CATEGORIES[tag];
  if (allowed) return allowed.some((c) => cat.startsWith(c));
  return !NON_FOOD_CATEGORIES.some((c) => cat.startsWith(c));
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
    // 28/09/2026 (ORD-025): era /mercado?classification02=..., que dependia da
    // arvore do ERP (muda na v3). valorFiltro e uma categoriaEcommerce.
    const categoria = BEVERAGE_CATEGORIA_TO_CATEGORY[valorFiltro];
    if (categoria) return `/mercado?cat=${encodeURIComponent(categoria)}`;
    return `/mercado?q=${encodeURIComponent(valorFiltro)}`;
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

  // ponytail: cache em memoria de 10 min por combinacao de query, servindo o
  // valor antigo enquanto recalcula em segundo plano. A home levava 1,3 s
  // (7,7 s com a AntenorApi fria) em TODA visita; as vitrines mudam por dia/
  // perfil, nao por minuto. Some no restart -- aceitavel para uma VPS.
  private cache = new Map<string, { at: number; value: Promise<Awaited<ReturnType<HomeVitrinesService['build']>>> }>();

  async getHomeVitrines(query: HomeVitrinesQuery) {
    const key = JSON.stringify(query ?? {});
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value;
    const value = this.build(query);
    if (hit) {
      // Tem valor antigo: responde com ele e so troca quando o novo ficar pronto
      // (renova o relogio ja, para varias visitas nao dispararem varios recalculos).
      this.cache.set(key, { at: Date.now(), value: hit.value });
      value.then(() => this.cache.set(key, { at: Date.now(), value })).catch(() => undefined);
      return hit.value;
    }
    this.cache.set(key, { at: Date.now(), value });
    value.catch(() => this.cache.delete(key));
    return value;
  }

  /** Departamento oculto/reexibido no admin vale na hora na Home. */
  clearCache() {
    this.cache.clear();
  }

  private async build(query: HomeVitrinesQuery) {
    const remota = await this.antenorApi.getVitrines(query);
    const notOffered = await notOfferedCategoryCodes(this.prisma);

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
        .filter((produto) => isAutoSurfaceable(produto, notOffered))
        .filter((produto) => carrossel.tipoFiltro !== 'tag' || !carrossel.valorFiltro || fitsTagShelf(carrossel.valorFiltro, produto.category))
        // A lista vem pronta da AntenorApi pelo departamento e-commerce, que
        // errava (talharim em "Carnes", 29/09). Carrossel de departamento so
        // mostra quem esta, pela nossa categoria (arvore v3), naquele departamento.
        .filter((produto) => {
          if (carrossel.tipoFiltro !== 'departamento') return true;
          const permitidas = departmentCategories(carrossel.valorFiltro);
          return !permitidas || permitidas.includes(String(produto.category));
        })
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
        // Departamento e-commerce -> categorias do site (1 ou, em "Bebidas &
        // Adega", 4). Nunca pela arvore do ERP, que muda na v3 (ORD-025).
        const categoryCodes =
          carrossel.tipoFiltro === 'departamento' ? departmentCategories(carrossel.valorFiltro) : null;
        const tagFiltro = carrossel.tipoFiltro === 'tag' ? carrossel.valorFiltro : undefined;
        // 22/09/2026: tipoFiltro='categoria' (ex.: "Carnes para o Dia a Dia",
        // valorFiltro='Bovinos') nunca tinha backfill -- so 'departamento' e
        // 'tag' eram tratados, entao essa vitrine ficava presa nos poucos
        // produtos que sobravam depois do filtro de sellability (achado com
        // 5/12). classification02 no banco vem com prefixo numerico
        // ("02 - BOVINOS"), por isso contains em vez de igualdade exata --
        // mesmo criterio do buildLinkVerTudo/buildPrismaWhere.
        const categoriaEcommerce = carrossel.tipoFiltro === 'categoria' ? carrossel.valorFiltro : undefined;

        if (categoryCodes || tagFiltro || categoriaEcommerce) {
          const reforco = await this.prisma.product.findMany({
            where: {
              id: { notIn: Array.from(jaUsados) },
              active: true,
              ...(categoryCodes ? { category: { in: categoryCodes } } : {}),
              ...(tagFiltro ? { tags: { has: tagFiltro } } : {}),
              ...(categoriaEcommerce ? { ecommerceCategory: { equals: categoriaEcommerce, mode: 'insensitive' } } : {}),
            },
            select: PRODUCT_SELECT,
            take: faltam * 3, // folga pra sobrar apos o filtro de isProductSellable
          });
          for (const produto of reforco) {
            if (produtosResolvidos.length >= TARGET_POOL_SIZE) break;
            if (jaUsados.has(produto.id) || !isAutoSurfaceable(produto, notOffered)) continue;
            if (tagFiltro && !fitsTagShelf(tagFiltro, produto.category)) continue;
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
