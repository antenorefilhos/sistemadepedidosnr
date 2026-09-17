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
 * JON-172: quota minima coerente pra uma vitrine valer a pena aparecer.
 * Abaixo disso o carrossel parece quebrado (1-2 cards soltos), nao curado --
 * a secao inteira some em vez de renderizar isso. Sem diferenciar mobile de
 * desktop aqui (o hook nao sabe o viewport); usa o piso mais conservador dos
 * dois (4) e deixa quem tem mais espaco (desktop) exibir menos do que podia.
 */
const MIN_SHELF_ITEMS = 4

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

  /**
   * JON-172: pool de candidatos por regra, SEM corte de exibicao e SEM
   * deduplicacao cruzada com outras regras -- so remove duplicata de SKU
   * dentro da propria fonte (residuo do sync do ERP, mesmo name+price).
   *
   * `categorized` e `intentShelves` bebem daqui. Antes, `intentShelves`
   * consumia diretamente de `categorized.*` -- que ja tinha sido cortado no
   * `limit` de exibicao (6-8) E dividido pela deduplicacao entre secoes que
   * reusam a mesma categoria (ex.: acougue alimentando churrasco E
   * carnes-dia-a-dia). Pool ja pequeno, dividido de novo: a segunda vitrine
   * de intencao que reusasse essa categoria sobrava com quase nada --
   * "vitrine esvaziada por deduplicacao sem reposicao". O backend agora
   * manda um pool bem maior que o limit de exibicao (ver
   * categories.service.ts, CANDIDATE_POOL_MAX); este hook e quem decide
   * quanto mostrar em cada secao, com espaco de sobra pra reposicao.
   */
  const rawByRule = useMemo(() => {
    const map = new Map<string, Product[]>()
    for (const config of enabledHomeRules) {
      const source = config.curatedProducts.length > 0 ? config.curatedProducts : config.products
      const seen = new Set<string>()
      const deduped: Product[] = []
      for (const product of source) {
        if (!product?.id) continue
        const key = dedupeKey(product)
        if (seen.has(key)) continue
        seen.add(key)
        deduped.push(product)
      }
      map.set(config.rule.id, deduped)
    }
    return map
  }, [enabledHomeRules])

  const ruleLimits = useMemo(() => {
    const map = new Map<string, number>()
    for (const config of enabledHomeRules) map.set(config.rule.id, config.limit)
    return map
  }, [enabledHomeRules])

  const categorized = useMemo(() => {
    const usedKeys = new Set<string>()

    /**
     * Fonte de cada secao: o pool de candidatos da regra (`rawByRule`), ja
     * na ordem de autoridade do Admin (curadoria manual > vitrine do
     * backend). O teto de exibicao vem do CMS (`limit`, default no
     * fallback); a deduplicacao entre secoes que reusam a mesma categoria
     * (acougue -> churrasco + carnes-dia-a-dia) continua acontecendo aqui.
     */
    const take = (ruleId: string, fallbackLimit: number) => {
      const source = rawByRule.get(ruleId) || []
      const limit = ruleLimits.get(ruleId) || fallbackLimit
      const picked: Product[] = []
      for (const product of source) {
        if (picked.length >= limit) break
        if (usedKeys.has(dedupeKey(product))) continue
        usedKeys.add(dedupeKey(product))
        picked.push(product)
      }
      return picked
    }

    return {
      consumoRapido: take('congelados', 6),
      guloseimas: take('doces', 6),
      // Acougue & Churrasco virou uma unica macro-categoria: as duas vitrines
      // abaixo dividem o mesmo pool via `usedKeys` (cada uma pega os produtos
      // que a outra ainda nao consumiu).
      churrasco: take('acougue', 6),
      carnesDiaADia: take('acougue', 6),
      feira: take('hortifruti', 8),
      padaria: take('padaria', 6),
      // Bebidas virou 4 categorias puras (adega/cervejas/destilados/sucos) --
      // a vitrine de churrasco combina com cerveja, nao com refrigerante.
      bebidas: take('cervejas', 6),
      // Alem de excluir o que ja foi para uma categoria, deduplica dentro de si:
      // "Tudo do Mercado" e onde os SKUs repetidos do ERP mais aparecem juntos.
      outros: productsList.filter((product) => {
        if (!product?.id || usedKeys.has(dedupeKey(product))) return false
        usedKeys.add(dedupeKey(product))
        return true
      }),
    }
  }, [rawByRule, ruleLimits, productsList])

  const homeCategories = useMemo(
    () =>
      enabledHomeRules
        .map((config) => ({
          id: config.rule.id,
          code: config.code,
          label: config.rule.label,
          shortLabel: config.rule.shortLabel,
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
      enabledHomeRules.find((config) => config.rule.id === 'adega' && hasProducts(config)) ||
      enabledHomeRules.find(hasProducts)

    if (!selected) return null

    const cleanLabel = selected.rule.label
    const cmsCode = selected.code || selected.rule.id.toUpperCase()
    const isWine = selected.rule.id === 'adega'

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
    // JON-172: bebe do pool AMPLO da regra (rawByRule), nao das secoes de
    // categoria ja cortadas no limit de exibicao -- e a causa raiz da
    // vitrine que esvaziava por deduplicacao sem reposicao.
    const acougue = rawByRule.get('acougue') || []
    const hortifruti = rawByRule.get('hortifruti') || []
    const cervejas = rawByRule.get('cervejas') || []
    const fresh = claim([...hortifruti, ...acougue])
    const fair = claim([...hortifruti])
    const churrascoOccasion = claim([...acougue, ...cervejas])
    const recurring = claim([...pantry, ...analyticsBestSellers])
    const bestSellers = claim(analyticsBestSellers, 8)

    return { rebuy, offers, fresh, fair, churrascoOccasion, recurring, bestSellers, claimed }
  }, [rawByRule, marginShowcase, productsList, promotionalProducts, rebuyProducts, topSellingProducts])

  /**
   * Um produto aparece uma unica vez na Home: o que as vitrines de intencao
   * levaram sai das secoes de categoria, que a Home renderiza direto.
   *
   * JON-172: com refill -- se sobrar abaixo do minimo coerente depois de
   * tirar o que foi pras vitrines de intencao, busca mais no pool amplo da
   * propria regra (ainda respeitando usedKeys global e o que intentShelves
   * ja reivindicou) antes de desistir. So ai, se AINDA estiver abaixo do
   * minimo, a secao inteira esvazia (a Home nao renderiza carrossel
   * acidental de 1-2 produtos -- ProductShelf ja oculta quando o array vem
   * vazio).
   */
  const visibleCategorized = useMemo(() => {
    const taken = intentShelves.claimed
    const shown = new Set<string>()
    for (const list of Object.values(categorized)) {
      for (const product of list) shown.add(dedupeKey(product))
    }

    const stripAndRefill = (items: Product[], ruleId: string | null) => {
      const kept = items.filter((product) => !taken.has(dedupeKey(product)))
      if (kept.length < items.length && ruleId) {
        const pool = rawByRule.get(ruleId) || []
        const keptKeys = new Set(kept.map(dedupeKey))
        for (const candidate of pool) {
          if (kept.length >= items.length) break
          const key = dedupeKey(candidate)
          if (taken.has(key) || keptKeys.has(key) || shown.has(key)) continue
          keptKeys.add(key)
          shown.add(key)
          kept.push(candidate)
        }
      }
      return kept.length >= MIN_SHELF_ITEMS ? kept : []
    }

    return {
      consumoRapido: stripAndRefill(categorized.consumoRapido, 'congelados'),
      guloseimas: stripAndRefill(categorized.guloseimas, 'doces'),
      churrasco: stripAndRefill(categorized.churrasco, 'acougue'),
      carnesDiaADia: stripAndRefill(categorized.carnesDiaADia, 'acougue'),
      feira: stripAndRefill(categorized.feira, 'hortifruti'),
      padaria: stripAndRefill(categorized.padaria, 'padaria'),
      bebidas: stripAndRefill(categorized.bebidas, 'cervejas'),
      // "Tudo do Mercado": sem regra unica pra reposicao (e o catch-all) --
      // so remove o que foi levado, sem piso minimo (e a vitrine de fallback
      // de tudo, esperado que varie de tamanho livremente).
      outros: categorized.outros.filter((product) => !taken.has(dedupeKey(product))),
    }
  }, [categorized, intentShelves, rawByRule])

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
