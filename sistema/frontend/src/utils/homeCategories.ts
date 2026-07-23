import {
  Apple,
  Beer,
  Beef,
  Candy,
  Croissant,
  CupSoda,
  Flame,
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
  label: string
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

/** Ordem comercial de exibicao quando o CMS nao define prioridade. */
export const HOME_COMMERCIAL_PRIORITY: Record<string, number> = {
  carnes: 1,
  churrasco: 2,
  hortifruti: 3,
  padaria: 4,
  bebidas: 5,
  cervejas: 6,
  vinhos: 7,
  praticos: 8,
  doces: 9,
  limpeza: 10,
  higiene: 11,
  perfumaria: 12,
}

export const HOME_CATEGORY_RULES: HomeCategoryRule[] = [
  { id: 'hortifruti', label: '🥬 Hortifruti Fresquinho', query: 'hortifruti' },
  { id: 'limpeza', label: '🧼 Limpeza da Casa', query: 'limpeza' },
  { id: 'higiene', label: '🧴 Higiene Pessoal', query: 'higiene pessoal' },
  { id: 'perfumaria', label: '✨ Perfumaria & Beleza', query: 'perfumaria' },
  { id: 'cervejas', label: '🍺 Cervejas Geladas', query: 'cerveja' },
  { id: 'bebidas', label: '🥤 Bebidas em Geral', query: 'bebidas' },
  { id: 'padaria', label: '🥖 Padaria & Forno', query: 'padaria' },
  { id: 'carnes', label: '🥩 Carnes Frescas', query: 'carnes' },
  { id: 'churrasco', label: '🔥 Para Churrasquear', query: 'churrasco' },
  { id: 'vinhos', label: '🍷 Adega & Vinhos', query: 'vinhos' },
  { id: 'doces', label: '🍫 Doces & Guloseimas', query: 'guloseimas' },
  { id: 'praticos', label: '🍔 Pronto pra Comer', query: 'consumo rapido' },
]

/**
 * Codigo de categoria do CMS -> id da regra local.
 *
 * A taxonomia do CMS foi reescrita e cinco codigos antigos ficaram inativos
 * (`CARNES_DIA_A_DIA`, `BEBIDAS`, `VINHOS`, `GULOSEIMAS`, `CONSUMO_RAPIDO`).
 * Os antigos seguem aqui so por compatibilidade: vem do backend como
 * `active: false`, entao sao descartados antes de virar vitrine.
 */
export const CMS_CATEGORY_TO_RULE_ID: Record<string, HomeCategoryRule['id']> = {
  // Codigos vigentes no CMS
  CARNES: 'carnes',
  CHURRASCO: 'churrasco',
  HORTIFRUTI: 'hortifruti',
  PADARIA: 'padaria',
  BEBIDAS_SEM_ALCOOL: 'bebidas',
  CERVEJAS: 'cervejas',
  ADEGA: 'vinhos',
  CHOCOLATES_BALAS_E_SNACKS: 'doces',
  LIMPEZA: 'limpeza',
  HIGIENE_PESSOAL: 'higiene',
  PERFUMARIA_E_BELEZA: 'perfumaria',
  // Legado — inativos no CMS, mantidos para nao quebrar links antigos
  CARNES_DIA_A_DIA: 'carnes',
  BEBIDAS: 'bebidas',
  VINHOS: 'vinhos',
  GULOSEIMAS: 'doces',
  CONSUMO_RAPIDO: 'praticos',
}

/**
 * Inverso — define QUAL codigo e consultado no backend (`?category=`) para
 * montar a vitrine, entao aponta sempre para o codigo vigente.
 */
export const RULE_ID_TO_CMS_CODE: Record<string, string> = {
  carnes: 'CARNES',
  churrasco: 'CHURRASCO',
  hortifruti: 'HORTIFRUTI',
  padaria: 'PADARIA',
  bebidas: 'BEBIDAS_SEM_ALCOOL',
  cervejas: 'CERVEJAS',
  vinhos: 'ADEGA',
  praticos: 'CONSUMO_RAPIDO',
  doces: 'CHOCOLATES_BALAS_E_SNACKS',
  limpeza: 'LIMPEZA',
  higiene: 'HIGIENE_PESSOAL',
  perfumaria: 'PERFUMARIA_E_BELEZA',
}

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  hortifruti: Apple,
  limpeza: Trash2,
  higiene: Smile,
  perfumaria: Sparkles,
  cervejas: Beer,
  bebidas: CupSoda,
  padaria: Croissant,
  carnes: Beef,
  churrasco: Flame,
  vinhos: Wine,
  doces: Candy,
  praticos: Pizza,
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
