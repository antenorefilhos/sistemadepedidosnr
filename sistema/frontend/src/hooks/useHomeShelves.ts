import { useMemo } from 'react'
import type { Product } from '../types'
import {
  CMS_CATEGORY_TO_RULE_ID,
  HOME_CATEGORY_RULES,
  HOME_COMMERCIAL_PRIORITY,
  normalizeCategoryCode,
  toCategoryUrlParam,
  type HomeCategoryRule,
} from '../utils/homeCategories'

/** Item vindo da API de taxonomia comercial do CMS (contrato fraco). */
type CMSCategoryItem = {
  active?: boolean
  code?: string
  name?: string
  limit?: number
  priority?: number
  productCount?: number
  curatedProducts?: Array<{ product?: Product }>
  /** Vitrine ja montada pelo backend (filtro por ProductCategoryMapping). */
  products?: Product[]
}

type CMSCategoryConfig = {
  rule: HomeCategoryRule
  /** Codigo real da categoria no CMS — usado para montar links `?cat=`. */
  code: string
  limit: number
  priority: number
  productCount: number
  curatedProducts: Product[]
  /** Produtos da vitrine ja vindos do backend (evita 1 request por categoria). */
  products: Product[]
}

type TopSellingItem = { product?: Product }

type UseHomeShelvesInput = {
  productsList: Product[]
  cmsCategories: unknown
  topSellingProducts: unknown
  rebuyProducts: Product[]
  marginShowcase: Product[]
  /** Lista real de promocoes (endpoint dedicado, sem limite de paginacao). */
  promotionalProducts?: Product[]
}

const PANTRY_TERMS = [
  'arroz',
  'feijao',
  'acucar',
  'cafe',
  'leite',
  'limpeza',
  'papel',
  'detergente',
  'sabao',
]

const SHELF_LIMIT = 10

/**
 * Chave de deduplicacao das vitrines.
 *
 * O catalogo tem SKUs distintos com nome E preco identicos (residuo do sync do
 * ERP): mesmo `name`, mesmo `price`, `id` diferente. Deduplicar so por `id`
 * deixa o mesmo produto aparecer lado a lado. Variante real difere no nome
 * (tamanho/sabor entram nele) ou no preco, entao nao e escondida por isso.
 */
const dedupeKey = (product: Product) => `${product.name ?? ''}::${product.price ?? ''}`

const dedupeById = (items: Product[]) => {
  const seen = new Set<string>()
  return items.filter((product) => {
    if (!product?.id || seen.has(product.id)) return false
    seen.add(product.id)
    return true
  })
}

/**
 * Monta as vitrines da Home.
 *
 * As "vitrines de intencao" (recompra, ofertas, frescos, feira, churrasco,
 * recorrentes e mais vendidos) sao montadas em ordem de prioridade com
 * deduplicacao GLOBAL: um produto aparece em uma unica vitrine. Sem isso as
 * cadeias de fallback fazem todas elas caírem no mesmo punhado de produtos.
 *
 * As secoes de categoria (`categorized`) NAO participam dessa deduplicacao —
 * ali a presenca do produto e semanticamente justificada.
 */
export function useHomeShelves({
  productsList,
  cmsCategories,
  topSellingProducts,
  rebuyProducts,
  marginShowcase,
  promotionalProducts = [],
}: UseHomeShelvesInput) {
  const enabledHomeRules = useMemo<CMSCategoryConfig[]>(() => {
    const list = Array.isArray(cmsCategories) ? (cmsCategories as CMSCategoryItem[]) : []
    const configs: CMSCategoryConfig[] = []

    list
      .filter((item) => item?.active !== false)
      .forEach((item) => {
        const categoryCode = normalizeCategoryCode(String(item?.code || item?.name || ''))
        const ruleId = CMS_CATEGORY_TO_RULE_ID[categoryCode]
        if (!ruleId) return

        const rule = HOME_CATEGORY_RULES.find((r) => r.id === ruleId)
        if (!rule) return

        configs.push({
          rule,
          code: categoryCode,
          limit: item?.limit ?? 6,
          priority: item?.priority ?? 0,
          productCount: Number(item?.productCount ?? 0),
          curatedProducts: Array.isArray(item?.curatedProducts)
            ? (item.curatedProducts as unknown as Product[])
            : [],
          products: Array.isArray(item?.products) ? (item.products as Product[]) : [],
        })
      })

    if (configs.length === 0) {
      return HOME_CATEGORY_RULES.map((rule) => ({
        rule,
        code: '',
        limit: 6,
        priority: HOME_COMMERCIAL_PRIORITY[rule.id] ?? 999,
        productCount: 0,
        curatedProducts: [],
        products: [],
      }))
    }

    return configs.sort((a, b) => a.priority - b.priority)
  }, [cmsCategories])

  const categorized = useMemo(() => {
    const usedKeys = new Set<string>()

    /**
     * Fonte de cada secao, na ordem de autoridade do Admin:
     * 1) curadoria manual da categoria no CMS;
     * 2) vitrine ja montada pelo backend (`config.products`, filtro EAN -> categoria).
     * Uma unica resposta de /cms/categories/commercial traz tudo — sem 1 request
     * por categoria, que batia no throttler (20 req/min). O teto vem do CMS (`limit`).
     */
    const take = (ruleId: string, fallbackLimit: number) => {
      const config = enabledHomeRules.find((item) => item.rule.id === ruleId)
      if (!config) return []

      const source =
        config.curatedProducts.length > 0 ? config.curatedProducts : config.products

      const limit = config.limit || fallbackLimit
      const picked: Product[] = []
      for (const product of source) {
        if (picked.length >= limit) break
        if (!product?.id || usedKeys.has(dedupeKey(product))) continue
        usedKeys.add(dedupeKey(product))
        picked.push(product)
      }
      return picked
    }

    return {
      consumoRapido: take('praticos', 6),
      guloseimas: take('doces', 6),
      churrasco: take('churrasco', 6),
      carnesDiaADia: take('carnes', 6),
      feira: take('hortifruti', 8),
      padaria: take('padaria', 6),
      bebidas: take('bebidas', 6),
      // Alem de excluir o que ja foi para uma categoria, deduplica dentro de si:
      // "Tudo do Mercado" e onde os SKUs repetidos do ERP mais aparecem juntos.
      outros: productsList.filter((product) => {
        if (!product?.id || usedKeys.has(dedupeKey(product))) return false
        usedKeys.add(dedupeKey(product))
        return true
      }),
    }
  }, [enabledHomeRules, productsList])

  const homeCategories = useMemo(
    () =>
      enabledHomeRules
        .map((config) => ({
          id: config.rule.id,
          code: config.code,
          label: config.rule.label,
          query: config.rule.query,
          count:
            (config.curatedProducts?.length || 0) > 0
              ? config.curatedProducts.length
              : config.productCount,
          priority: config.priority,
        }))
        .filter((category) => category.count > 0)
        .sort((a, b) => a.priority - b.priority),
    [enabledHomeRules],
  )

  const featuredCommercialSection = useMemo(() => {
    const hasProducts = (config: CMSCategoryConfig) =>
      (config.curatedProducts?.length || 0) > 0 || config.productCount > 0

    const selected =
      enabledHomeRules.find((config) => config.rule.id === 'vinhos' && hasProducts(config)) ||
      enabledHomeRules.find(hasProducts)

    if (!selected) return null

    const cleanLabel = selected.rule.label.replace(/^\S+\s*/, '').trim()
    const cmsCode = selected.code || selected.rule.id.toUpperCase()
    const isWine = selected.rule.id === 'vinhos'

    return {
      badge: isWine ? 'Adega Exclusiva' : 'Selecao Especial',
      title: isWine ? 'Vinhos para toda ocasião' : `${cleanLabel} em destaque`,
      description: isWine
        ? 'Uma seleção pronta para impressionar, presentear e completar pedidos especiais.'
        : `Produtos selecionados da categoria ${cleanLabel.toLowerCase()} para completar seus pedidos.`,
      ctaLabel: isWine ? 'Acessar Adega' : `Ver ${cleanLabel}`,
      ctaTo: isWine ? '/adega' : `/mercado?cat=${toCategoryUrlParam(cmsCode)}`,
    }
  }, [enabledHomeRules])

  /**
   * Vitrines de intencao, montadas em cascata com deduplicacao global.
   * A ordem define quem tem prioridade de escolha sobre o pool de produtos.
   */
  const intentShelves = useMemo(() => {
    const analyticsBestSellers = Array.isArray(topSellingProducts)
      ? (topSellingProducts as TopSellingItem[])
          .map((item) => item?.product)
          .filter((product): product is Product => Boolean(product?.id))
      : []

    // Endpoint dedicado primeiro (catalogo inteiro, sem paginacao) -- so cai
    // pro filtro local se a lista dedicada ainda nao carregou.
    const promotional = promotionalProducts.length > 0
      ? promotionalProducts
      : productsList.filter(
          (product) =>
            typeof product.promotionalPrice === 'number' &&
            product.promotionalPrice > 0 &&
            product.promotionalPrice < product.price,
        )

    const pantry = productsList.filter((product) => {
      const haystack = `${product.category || ''} ${product.name || ''}`
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
      return PANTRY_TERMS.some((term) => haystack.includes(term))
    })

    const claimed = new Set<string>()

    /** Consome candidatos em ordem, pulando o que ja foi usado em outra vitrine. */
    const claim = (candidates: Product[], limit = SHELF_LIMIT) => {
      const picked: Product[] = []
      for (const product of candidates) {
        if (picked.length >= limit) break
        if (!product?.id || claimed.has(dedupeKey(product))) continue
        claimed.add(dedupeKey(product))
        picked.push(product)
      }
      return picked
    }

    // A ordem abaixo e a prioridade de escolha sobre o pool.
    const rebuy = claim(
      rebuyProducts.length > 0 ? rebuyProducts : analyticsBestSellers,
    )
    // Cada vitrine so aceita fonte que honra o proprio titulo. Sem fonte valida
    // ela volta vazia e o ProductShelf some — melhor que enchimento generico.
    const offers = claim([...promotional, ...marginShowcase])
    // Padaria fica de fora: tem secao dedicada logo abaixo na Home.
    const fresh = claim([...categorized.feira, ...categorized.carnesDiaADia])
    const fair = claim([...categorized.feira])
    const churrascoOccasion = claim([
      ...categorized.churrasco,
      ...categorized.carnesDiaADia,
      ...categorized.bebidas,
    ])
    const recurring = claim([...pantry, ...analyticsBestSellers])
    const bestSellers = claim(analyticsBestSellers, 8)

    return { rebuy, offers, fresh, fair, churrascoOccasion, recurring, bestSellers, claimed }
  }, [categorized, marginShowcase, productsList, promotionalProducts, rebuyProducts, topSellingProducts])

  /**
   * Um produto aparece uma unica vez na Home: o que as vitrines de intencao
   * levaram sai das secoes de categoria, que a Home renderiza direto.
   */
  const visibleCategorized = useMemo(() => {
    const taken = intentShelves.claimed
    const strip = (items: Product[]) => items.filter((product) => !taken.has(dedupeKey(product)))
    return {
      consumoRapido: strip(categorized.consumoRapido),
      guloseimas: strip(categorized.guloseimas),
      churrasco: strip(categorized.churrasco),
      carnesDiaADia: strip(categorized.carnesDiaADia),
      feira: strip(categorized.feira),
      padaria: strip(categorized.padaria),
      bebidas: strip(categorized.bebidas),
      outros: strip(categorized.outros),
    }
  }, [categorized, intentShelves])

  return {
    enabledHomeRules,
    categorized: visibleCategorized,
    homeCategories,
    featuredCommercialSection,
    bestSellers: intentShelves.bestSellers,
    rebuyShelf: intentShelves.rebuy,
    offersShelf: intentShelves.offers,
    freshShelf: intentShelves.fresh,
    fairShelf: intentShelves.fair,
    churrascoOccasionShelf: intentShelves.churrascoOccasion,
    recurringShelf: intentShelves.recurring,
  }
}

export { dedupeById }
