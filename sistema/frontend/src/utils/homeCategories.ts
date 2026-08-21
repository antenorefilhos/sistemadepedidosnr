import {
  Apple,
  Beef,
  Beer,
  Candy,
  Cigarette,
  Croissant,
  Dog,
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
 * Taxonomia oficial de 15 macro-categorias N1 (ver
 * TASK_DEV_CATEGORIAS_MAPPING.md). `id` e a chave interna curta usada por
 * useHomeShelves; o codigo real do CMS entra via CMS_CATEGORY_TO_RULE_ID.
 * Tabacaria fica deliberadamente por ultimo.
 */
export const HOME_COMMERCIAL_PRIORITY: Record<string, number> = {
  acougue: 1,
  adega: 2,
  bebidas: 3,
  hortifruti: 4,
  queijos: 5,
  padaria: 6,
  mercearia: 7,
  gourmet: 8,
  congelados: 9,
  doces: 10,
  limpeza: 11,
  higiene: 12,
  pet: 13,
  bazar: 14,
  tabacaria: 15,
}

export const HOME_CATEGORY_RULES: HomeCategoryRule[] = [
  { id: 'acougue', label: 'Açougue & Churrasco', shortLabel: 'Açougue', query: 'carnes' },
  { id: 'adega', label: 'Adega & Destilados', shortLabel: 'Adega & Vinhos', query: 'vinhos' },
  { id: 'bebidas', label: 'Cervejas & Bebidas Geladas', shortLabel: 'Bebidas', query: 'bebidas' },
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
  // Codigos oficiais (ver TASK_DEV_CATEGORIAS_TAXONOMIA.md)
  ACOUQUE_E_CHURRASCO: 'acougue',
  ADEGA_E_DESTILADOS: 'adega',
  CERVEJAS_E_BEBIDAS: 'bebidas',
  HORTIFRUTI_E_ORGANICOS: 'hortifruti',
  QUEIJOS_E_LATICINIOS: 'queijos',
  PADARIA_E_CONFEITARIA: 'padaria',
  MERCEARIA_E_DESPENSA: 'mercearia',
  ESPACO_GOURMET: 'gourmet',
  CONGELADOS_E_PRATICOS: 'congelados',
  DOCES_E_SNACKS: 'doces',
  LIMPEZA_E_CASA: 'limpeza',
  HIGIENE_E_PERFUMARIA: 'higiene',
  PET_SHOP: 'pet',
  BAZAR_E_UTILIDADES: 'bazar',
  TABACARIA: 'tabacaria',
  // Legado — inativos no CMS, mantidos para nao quebrar links antigos
  HIGIENE_E_PET: 'higiene',
  CARNES: 'acougue',
  CHURRASCO: 'acougue',
  CARNES_DIA_A_DIA: 'acougue',
  ADEGA: 'adega',
  VINHOS: 'adega',
  BEBIDAS: 'bebidas',
  BEBIDAS_SEM_ALCOOL: 'bebidas',
  CERVEJAS: 'bebidas',
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
  bebidas: Beer,
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
