import { useMemo } from 'react'
import type { Product } from '../types'
import {
  CMS_CATEGORY_TO_RULE_ID,
  HOME_CATEGORY_RULES,
  HOME_COMMERCIAL_PRIORITY,
  RULE_ID_TO_CMS_CODE,
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
}

type CMSCategoryConfig = {
  rule: HomeCategoryRule
  limit: number
  priority: number
  productCount: number
  curatedProducts: Product[]
}

type TopSellingItem = { product?: Product }

type UseHomeShelvesInput = {
  productsList: Product[]
  cmsCategories: unknown
  topSellingProducts: unknown
  rebuyProducts: Product[]
  marginShowcase: Product[]
}

/** Categorias que possuem secao dedicada na Home. */
const SECTION_RULE_IDS = new Set([
  'praticos',
  'doces',
  'churrasco',
  'carnes',
  'hortifruti',
  'padaria',
  'bebidas',
])

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
}: UseHomeShelvesInput) {
  const enabledHomeRules = useMemo<CMSCategoryConfig[]>(() => {
    const list = Array.isArray(cmsCategories) ? (cmsCategories as CMSCategoryItem[]) : []
    const configs: CMSCategoryConfig[] = []

    list
      .filter((item) => item?.active !== false)
      .forEach((item) => {
        const categoryCode = String(item?.code || item?.name || '')
        const ruleId = CMS_CATEGORY_TO_RULE_ID[normalizeCategoryCode(categoryCode)]
        if (!ruleId) return

        const rule = HOME_CATEGORY_RULES.find((r) => r.id === ruleId)
        if (!rule) return

        configs.push({
          rule,
          limit: item?.limit ?? 6,
          priority: item?.priority ?? 0,
          productCount: Number(item?.productCount ?? 0),
          curatedProducts: Array.isArray(item?.curatedProducts)
            ? (item.curatedProducts as unknown as Product[])
            : [],
        })
      })

    if (configs.length === 0) {
      return HOME_CATEGORY_RULES.map((rule) => ({
        rule,
        limit: 6,
        priority: HOME_COMMERCIAL_PRIORITY[rule.id] ?? 999,
        productCount: 0,
        curatedProducts: [],
      }))
    }

    return configs.sort((a, b) => a.priority - b.priority)
  }, [cmsCategories])

  const categorized = useMemo(() => {
    const bucketByRule = new Map<string, Product[]>()
    const limitsMap = new Map<string, number>()
    const enabledRuleIds = new Set(enabledHomeRules.map((config) => config.rule.id))
    const usedProductIds = new Set<string>()

    enabledHomeRules.forEach((config) => {
      const curated = (config.curatedProducts || []).filter((product) => {
        if (!product?.id || usedProductIds.has(product.id)) return false
        usedProductIds.add(product.id)
        return true
      })

      bucketByRule.set(config.rule.id, curated)
      limitsMap.set(config.rule.id, config.limit)
    })

    const unmatched: Product[] = []

    for (const product of productsList) {
      if (usedProductIds.has(product.id)) continue

      const ruleId = CMS_CATEGORY_TO_RULE_ID[normalizeCategoryCode(product.category || '')]

      if (ruleId && enabledRuleIds.has(ruleId)) {
        usedProductIds.add(product.id)
        if (SECTION_RULE_IDS.has(ruleId)) {
          bucketByRule.get(ruleId)?.push(product)
          continue
        }
      }

      unmatched.push(product)
    }

    const take = (ruleId: string, fallbackLimit: number) =>
      (bucketByRule.get(ruleId) || []).slice(0, limitsMap.get(ruleId) || fallbackLimit)

    return {
      consumoRapido: take('praticos', 6),
      guloseimas: take('doces', 6),
      churrasco: take('churrasco', 6),
      carnesDiaADia: take('carnes', 6),
      feira: take('hortifruti', 8),
      padaria: take('padaria', 6),
      bebidas: take('bebidas', 6),
      outros: unmatched,
    }
  }, [productsList, enabledHomeRules])

  const homeCategories = useMemo(
    () =>
      enabledHomeRules
        .map((config) => ({
          id: config.rule.id,
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
    const cmsCode = RULE_ID_TO_CMS_CODE[selected.rule.id] || selected.rule.id.toUpperCase()
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

    const promotional = productsList.filter(
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

    const categoryPool = [
      ...categorized.churrasco,
      ...categorized.carnesDiaADia,
      ...categorized.padaria,
      ...categorized.guloseimas,
      ...categorized.bebidas,
      ...categorized.consumoRapido,
      ...categorized.outros,
    ]

    const claimed = new Set<string>()

    /** Consome candidatos em ordem, pulando o que ja foi usado em outra vitrine. */
    const claim = (candidates: Product[], limit = SHELF_LIMIT) => {
      const picked: Product[] = []
      for (const product of candidates) {
        if (picked.length >= limit) break
        if (!product?.id || claimed.has(product.id)) continue
        claimed.add(product.id)
        picked.push(product)
      }
      return picked
    }

    // A ordem abaixo e a prioridade de escolha sobre o pool.
    const rebuy = claim(
      rebuyProducts.length > 0 ? rebuyProducts : [...analyticsBestSellers, ...categorized.outros],
    )
    const offers = claim([...promotional, ...marginShowcase, ...analyticsBestSellers, ...categoryPool])
    const fresh = claim([
      ...categorized.feira,
      ...categorized.carnesDiaADia,
      ...categorized.padaria,
      ...categorized.outros,
    ])
    const fair = claim([...categorized.feira, ...categorized.outros])
    const churrascoOccasion = claim([
      ...categorized.churrasco,
      ...categorized.carnesDiaADia,
      ...categorized.bebidas,
    ])
    const recurring = claim([...pantry, ...analyticsBestSellers, ...categoryPool])
    const bestSellers = claim(
      analyticsBestSellers.length > 0 ? [...analyticsBestSellers, ...categoryPool] : categoryPool,
      8,
    )

    return { rebuy, offers, fresh, fair, churrascoOccasion, recurring, bestSellers }
  }, [categorized, marginShowcase, productsList, rebuyProducts, topSellingProducts])

  return {
    enabledHomeRules,
    categorized,
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
