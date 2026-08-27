import {
  Apple,
  Beef,
  Beer,
  Candy,
  Cigarette,
  Croissant,
  CupSoda,
  Dog,
  GlassWater,
  Milk,
  Package,
  Pizza,
  ShoppingBag,
  Smile,
  Sparkles,
  Trash2,
  Wine,
  type LucideIcon,
} from 'lucide-react'

export type HomeCategoryRule = {
  id: string
  /** Nome completo — menu gaveta, titulos de vitrine e cabecalhos. */
  label: string
  /** Nome curto — circulos de atalho mobile e pilulas de filtro (1-2 palavras, nunca trunca). */
  shortLabel: string
  query: string
}

/** Normaliza um codigo de categoria para a forma canonica (sem acento, MAIUSCULO, _). */
export const normalizeCategoryCode = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

/** Converte um codigo de categoria para o formato usado em `?cat=` na URL. */
export const toCategoryUrlParam = (value: string) =>
  normalizeCategoryCode(value).toLowerCase().replace(/_/g, '-')

/**
 * Link de destino de uma categoria nos circulos/pilulas de atalho. Adega vai
 * direto pra `/adega` (pagina dedicada da Adega Antenor) em vez do filtro
 * generico `/mercado?cat=`, em qualquer clique de categoria no storefront.
 */
export const getCategoryHref = (category: { id: string; code?: string }) =>
  category.id === 'adega'
    ? '/adega'
    : `/mercado?cat=${toCategoryUrlParam(category.code || category.id.toUpperCase())}`

/**
 * Taxonomia oficial de 17 macro-categorias N1 (ver
 * TASK_DEV_BEBIDAS_TAXONOMIA.md). `id` e a chave interna curta usada por
 * useHomeShelves; o codigo real do CMS entra via CMS_CATEGORY_TO_RULE_ID.
 * Bebidas foi dividida em 4 categorias puras (adega/cervejas/destilados/
 * sucos) pra nao misturar destilado com carta de vinho nem cerveja com
 * refresco em po. Tabacaria fica deliberadamente por ultimo.
 */
export const HOME_COMMERCIAL_PRIORITY: Record<string, number> = {
  acougue: 1,
  adega: 2,
  cervejas: 3,
  destilados: 4,
  sucos: 5,
  hortifruti: 6,
  queijos: 7,
  padaria: 8,
  mercearia: 9,
  gourmet: 10,
  congelados: 11,
  doces: 12,
  limpeza: 13,
  higiene: 14,
  pet: 15,
  bazar: 16,
  tabacaria: 17,
}

export const HOME_CATEGORY_RULES: HomeCategoryRule[] = [
  { id: 'acougue', label: 'Açougue & Churrasco', shortLabel: 'Açougue', query: 'carnes' },
  { id: 'adega', label: 'Adega, Vinhos & Espumantes', shortLabel: 'Adega & Vinhos', query: 'vinhos' },
  { id: 'cervejas', label: 'Cervejas & Chopp', shortLabel: 'Cervejas', query: 'cervejas' },
  { id: 'destilados', label: 'Destilados & Coquetéis', shortLabel: 'Destilados', query: 'destilados' },
  { id: 'sucos', label: 'Sucos & Refrigerantes', shortLabel: 'Sucos & Refrescos', query: 'sucos' },
  { id: 'hortifruti', label: 'Hortifruti & Orgânicos', shortLabel: 'Hortifruti', query: 'hortifruti' },
  { id: 'queijos', label: 'Queijos, Frios & Laticínios', shortLabel: 'Frios & Queijos', query: 'queijos' },
  { id: 'padaria', label: 'Padaria, Confeitaria & Café', shortLabel: 'Padaria', query: 'padaria' },
  { id: 'mercearia', label: 'Mercearia & Despensa', shortLabel: 'Mercearia', query: 'mercearia' },
  { id: 'gourmet', label: 'Espaço Gourmet & Importados', shortLabel: 'Gourmet', query: 'gourmet' },
  { id: 'congelados', label: 'Congelados & Práticos', shortLabel: 'Congelados', query: 'congelados' },
  { id: 'doces', label: 'Doces, Chocolates & Snacks', shortLabel: 'Doces & Snacks', query: 'doces' },
  { id: 'limpeza', label: 'Limpeza & Cuidados da Casa', shortLabel: 'Limpeza', query: 'limpeza' },
  { id: 'higiene', label: 'Higiene & Perfumaria', shortLabel: 'Higiene', query: 'higiene' },
  { id: 'pet', label: 'Pet Shop', shortLabel: 'Pet Shop', query: 'pet' },
  { id: 'bazar', label: 'Bazar & Utilidades', shortLabel: 'Utilidades', query: 'bazar' },
  { id: 'tabacaria', label: 'Tabacaria', shortLabel: 'Tabacaria', query: 'tabacaria' },
]

/**
 * Codigo de categoria do CMS -> id da regra local.
 *
 * A taxonomia foi consolidada em 12 macro-categorias N1 (antes carnes e
 * churrasco, cervejas e bebidas, higiene e perfumaria eram categorias
 * separadas). Codigos antigos seguem mapeados por compatibilidade: vem do
 * backend como `active: false` (seed-cms-categories.ts desativa o que nao
 * esta na taxonomia oficial), entao sao descartados antes de virar vitrine,
 * mas um link ja compartilhado com `?cat=CARNES` continua resolvendo.
 */
export const CMS_CATEGORY_TO_RULE_ID: Record<string, HomeCategoryRule['id']> = {
  // Codigos oficiais (nomes normalizados vindos do CMS)
  ACOUGUE_CHURRASCO: 'acougue',
  ACOUQUE_E_CHURRASCO: 'acougue',
  ADEGA_VINHOS_ESPUMANTES: 'adega',
  CERVEJAS_CHOPP: 'cervejas',
  CERVEJAS_E_CHOPP: 'cervejas',
  DESTILADOS_COQUETEIS: 'destilados',
  DESTILADOS_E_COQUETEIS: 'destilados',
  SUCOS_REFRIGERANTES: 'sucos',
  SUCOS_E_REFRIGERANTES: 'sucos',
  HORTIFRUTI_ORGANICOS: 'hortifruti',
  HORTIFRUTI_E_ORGANICOS: 'hortifruti',
  QUEIJOS_FRIOS_LATICINIOS: 'queijos',
  QUEIJOS_E_LATICINIOS: 'queijos',
  PADARIA_CONFEITARIA_CAFE: 'padaria',
  PADARIA_E_CONFEITARIA: 'padaria',
  MERCEARIA_DESPENSA: 'mercearia',
  MERCEARIA_E_DESPENSA: 'mercearia',
  ESPACO_GOURMET_IMPORTADOS: 'gourmet',
  ESPACO_GOURMET: 'gourmet',
  CONGELADOS_PRATICOS: 'congelados',
  CONGELADOS_E_PRATICOS: 'congelados',
  DOCES_CHOCOLATES_SNACKS: 'doces',
  DOCES_E_SNACKS: 'doces',
  LIMPEZA_CUIDADOS_DA_CASA: 'limpeza',
  LIMPEZA_E_CASA: 'limpeza',
  HIGIENE_PERFUMARIA: 'higiene',
  HIGIENE_E_PERFUMARIA: 'higiene',
  PET_SHOP: 'pet',
  BAZAR_UTILIDADES: 'bazar',
  BAZAR_E_UTILIDADES: 'bazar',
  TABACARIA: 'tabacaria',
  // Legado — inativos no CMS, mantidos para nao quebrar links antigos
  HIGIENE_E_PET: 'higiene',
  HIGIENE_BELEZA_PET: 'higiene',
  CARNES: 'acougue',
  CHURRASCO: 'acougue',
  CARNES_DIA_A_DIA: 'acougue',
  ADEGA_DESTILADOS: 'adega',
  ADEGA_E_DESTILADOS: 'adega',
  ADEGA: 'adega',
  VINHOS: 'adega',
  CERVEJAS_BEBIDAS_GELADAS: 'cervejas',
  CERVEJAS_E_BEBIDAS: 'cervejas',
  BEBIDAS: 'sucos',
  BEBIDAS_SEM_ALCOOL: 'sucos',
  CERVEJAS: 'cervejas',
  HORTIFRUTI: 'hortifruti',
  PADARIA: 'padaria',
  MERCEARIA: 'mercearia',
  CONGELADOS: 'congelados',
  CONSUMO_RAPIDO: 'congelados',
  CHOCOLATES_BALAS_E_SNACKS: 'doces',
  GULOSEIMAS: 'doces',
  LIMPEZA: 'limpeza',
  HIGIENE_PESSOAL: 'higiene',
  PERFUMARIA_E_BELEZA: 'higiene',
  PERFUMARIA: 'higiene',
}

// Nao ha mais mapa inverso rule.id -> codigo do CMS: cada vitrine/atalho usa o
// `code` que o proprio /cms/categories/commercial devolveu (ver useHomeShelves e
// homeCategories). Um mapa fixo aqui reapontava para categorias extintas quando a
// taxonomia mudava — foi o que deixou a Adega e "Pronto pra Comer" vazias.

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  acougue: Beef,
  adega: Wine,
  cervejas: Beer,
  destilados: GlassWater,
  sucos: CupSoda,
  hortifruti: Apple,
  queijos: Milk,
  padaria: Croissant,
  mercearia: ShoppingBag,
  gourmet: Sparkles,
  congelados: Pizza,
  doces: Candy,
  limpeza: Trash2,
  higiene: Smile,
  pet: Dog,
  bazar: Package,
  tabacaria: Cigarette,
  default: ShoppingBag,
}

/**
 * Banner de topo da pagina de categoria (StoreBanner slot=category).
 *
 * O casamento e feito aqui no cliente, sobre a lista que `useStoreBanners()`
 * ja tem em cache, em vez de bater no `?category=` do backend: aquele filtro e
 * igualdade exata de string contra `targetCategory`, entao "Acougue Churrasco"
 * nao acha "AÇOUGUE CHURRASCO" nem "acougue-churrasco" -- e a pagina de
 * categoria so conhece o codigo normalizado que veio da URL. Normalizando os
 * dois lados, acento/caixa/hifen deixam de importar. De quebra evita uma
 * segunda requisicao por pagina de categoria.
 *
 * A vigencia (startDate/endDate e encarte vinculado) ja vem resolvida do
 * servidor -- `GET /cms/store-banners` so devolve banner vigente --, entao
 * aqui basta filtrar slot/foto e casar a categoria.
 */
type CategoryBannerLike = {
  slot?: string
  active?: boolean
  targetCategory?: string | null
  desktopImageUrl?: string
  order?: number
}

const isDisplayableCategoryBanner = (banner: CategoryBannerLike) =>
  banner.slot === 'category' && banner.active !== false && Boolean(banner.desktopImageUrl)

// Empate resolvido pelo `order` do admin (mesma ordenacao das outras listas de
// banner), pra dois banners na mesma categoria nao alternarem a cada render.
const lowestOrderFirst = <T extends CategoryBannerLike>(banners: T[]) =>
  [...banners].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]

export const findCategoryBanner = <T extends CategoryBannerLike>(
  banners: T[] | undefined,
  categoryCode?: string | null,
): T | undefined => {
  if (!Array.isArray(banners) || !categoryCode?.trim()) return undefined
  const target = normalizeCategoryCode(categoryCode)
  if (!target) return undefined
  const matches = banners.filter(
    (banner) =>
      isDisplayableCategoryBanner(banner) &&
      banner.targetCategory &&
      normalizeCategoryCode(banner.targetCategory) === target,
  )
  return matches.length ? lowestOrderFirst(matches) : undefined
}

/**
 * A Adega tem pagina propria (`/adega`), sem `?cat=` na URL, entao nao da pra
 * casar por codigo. Vale a mesma regra que `resolveBannerLink` usa pra mandar
 * um banner de categoria pra /adega -- assim o banner que aponta pra Adega e o
 * banner que aparece na Adega sao sempre o mesmo.
 */
export const findWineCategoryBanner = <T extends CategoryBannerLike>(
  banners: T[] | undefined,
): T | undefined => {
  if (!Array.isArray(banners)) return undefined
  const matches = banners.filter((banner) => {
    if (!isDisplayableCategoryBanner(banner) || !banner.targetCategory) return false
    const code = normalizeCategoryCode(banner.targetCategory)
    return code.includes('ADEGA') || code.includes('VINHO')
  })
  return matches.length ? lowestOrderFirst(matches) : undefined
}

/** Normaliza os aliases da Adega para uma rota unica. */
export const normalizeWineLink = (link?: string) => {
  if (!link) return '#'
  const normalized = link.trim().toLowerCase()
  if (normalized === '/vinhos' || normalized === '/adega' || normalized === '/adega-antenor') {
    return '/adega'
  }
  return link
}

/**
 * Converte o `linkValue` de um StoreBanner (id de produto, nome de categoria
 * ou URL/rota) na rota valida correspondente no storefront, evitando link
 * quebrado ou filtro vazio. `linkType` vem do proprio banner (StoreBanner.linkType)
 * e decide o formato de `linkValue` -- sem ele nao da pra saber se um valor
 * como "cmspojqwu000eo6fecglzp23m" e um id de produto ou um slug de categoria.
 */
export const resolveBannerLink = (linkValue?: string | null, linkType?: string): string => {
  if (!linkValue || !linkValue.trim()) return '/mercado'
  const trimmed = linkValue.trim()

  // URL externa completa (http:// ou https://)
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  // Produto: linkValue e o id do produto, rota fixa /produto/:id (ver App.tsx)
  if (linkType === 'product') {
    return trimmed.startsWith('/produto/') ? trimmed : `/produto/${trimmed}`
  }

  // Rota relativa ja formatada (ex: link avulso tipo "url" apontando /promocoes)
  if (trimmed.startsWith('/') && !trimmed.includes(' ') && !trimmed.includes('&')) {
    return normalizeWineLink(trimmed)
  }

  // Categoria: nome vindo do CMS -> slug de ?cat=. Adega tem pagina propria.
  const clean = trimmed.replace(/^\//, '').trim()
  const lower = clean.toLowerCase()
  if (lower.includes('adega') || lower.includes('vinho')) return '/adega'

  const slug = toCategoryUrlParam(clean)
  if (slug) return `/mercado?cat=${slug}`

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/**
 * overlayColor do banner (StoreBanner.overlayColor) vem em dois formatos:
 * hex "#231F20" (default e banner antigo, editado a mao) ou "rgba(r, g, b, a)"
 * (color picker do admin, ver StoreBannersManager.tsx). Este parser normaliza
 * os dois formatos pra {r,g,b,a}, com fallback pro marrom Antenor quando o
 * valor nao bate com nenhum dos dois (nunca deixa `undefined` vazar pro CSS).
 */
const parseTone = (tone: string): { r: number; g: number; b: number; a: number } => {
  const trimmed = tone.trim()
  const rgbaMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/i)
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      a: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    }
  }
  const hexMatch = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hexMatch) {
    const clean = hexMatch[1].length === 3 ? hexMatch[1].split('').map((c) => c + c).join('') : hexMatch[1]
    const num = parseInt(clean, 16)
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255, a: 1 }
  }
  return { r: 0x23, g: 0x1f, b: 0x20, a: 1 }
}

/**
 * Gradiente do PromoBanner/HeroSlider: escurece o lado onde o texto fica e
 * deixa o lado oposto limpo pra foto aparecer. A direcao acompanha o
 * alinhamento configurado no admin -- num banner align=right o gradiente
 * fixo `to right` escurecia justamente o lado vazio e deixava o texto por
 * cima da parte clara da foto.
 *
 * Center nao tem lado livre (o texto fica no meio), entao usa gradiente
 * vertical: escurece topo e base e alivia o miolo, mantendo contraste sem
 * chapar a imagem inteira.
 *
 * O primeiro stop usa o alpha configurado sem atenuar (multiplicador 1): quem
 * escolhe uma cor no color picker ja escolheu a opacidade junto, e reduzir
 * pra 0.85 antes de pintar fazia cor forte (verde, azul, dourado) aparecer
 * lavada e dificil de distinguir de outra. A atenuacao fica so no stop do
 * meio pra frente, que e onde a foto precisa reaparecer.
 *
 * Os stops sao montados com rgba() completo de proposito: a versao antiga
 * concatenava sufixo de alpha em hex na string (`${tone}D1`), o que gera CSS
 * invalido pra cor vinda em rgba() do color picker (`rgba(...)D1`) e faz o
 * overlay sumir calado (background invalido = browser descarta a regra toda).
 */
export const buildOverlayGradient = (tone: string, align: 'left' | 'center' | 'right' = 'left'): string => {
  const { r, g, b, a } = parseTone(tone)
  const rgba = (multiplier: number) => `rgba(${r}, ${g}, ${b}, ${(a * multiplier).toFixed(2)})`

  if (align === 'center') {
    return `linear-gradient(to bottom, ${rgba(1)} 0%, ${rgba(0.6)} 50%, ${rgba(1)} 100%)`
  }

  const direction = align === 'right' ? 'to left' : 'to right'
  return `linear-gradient(${direction}, ${rgba(1)} 0%, ${rgba(0.75)} 55%, transparent 100%)`
}

/**
 * Tinta uniforme (sem gradiente direcional) pra tarja e popup -- conteudo
 * espalhado pela largura toda (tarja) ou centralizado num cartao pequeno
 * (popup), onde um fade lateral deixaria texto ilegivel de um dos lados.
 */
export const buildOverlaySolid = (tone: string, alphaMultiplier = 0.72): string => {
  const { r, g, b, a } = parseTone(tone)
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, a * alphaMultiplier).toFixed(2)})`
}
