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

/** Normaliza os aliases da Adega para uma rota unica. */
export const normalizeWineLink = (link?: string) => {
  if (!link) return '#'
  const normalized = link.trim().toLowerCase()
  if (normalized === '/vinhos' || normalized === '/adega' || normalized === '/adega-antenor') {
    return '/adega'
  }
  return link
}
