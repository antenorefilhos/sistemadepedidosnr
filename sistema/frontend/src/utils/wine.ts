import type { Product } from '../types'

// Ficha do vinho (03/10/2026). Vem da curadoria por rotulo (wineProfile, editavel
// no admin). Enquanto um vinho nao tem ficha, o basico sai do que o ERP ja diz:
// tipo pela classificacao v3, pais e uva pelo nome. Assim os filtros da Adega
// funcionam para todos, e melhoram sozinhos quando a ficha chega.

export type WineProfile = {
  nomeRotulo?: string
  produtor?: string
  marcaLinha?: string
  pais?: string
  regiaoDenominacao?: string
  classificacao?: string
  tipo?: 'tinto' | 'branco' | 'rosé' | 'espumante' | 'fortificado' | 'sobremesa'
  estilo?: 'seco' | 'meio-seco' | 'suave' | 'brut' | 'extra-brut' | 'nature' | 'demi-sec' | 'sem álcool'
  uvas?: string[]
  teorAlcoolico?: string
  volume?: string
  descricaoCurta?: string
  notasDegustacao?: string
  harmonizacao?: string
  temperaturaServico?: string
  guarda?: string
  fontes?: string[]
}

export type WineFacts = {
  tipo: NonNullable<WineProfile['tipo']> | null
  estilo: NonNullable<WineProfile['estilo']> | null
  pais: string | null
  uvas: string[]
  regiao: string | null
  produtor: string | null
  /** Da curadoria (true) ou deduzido do nome (false). */
  curado: boolean
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const COUNTRY_BY_ADJECTIVE: Array<[RegExp, string]> = [
  [/\bargentin[oa]\b/, 'Argentina'],
  [/\bchilen[oa]\b/, 'Chile'],
  [/\b(nacional|brasileir[oa])\b/, 'Brasil'],
  [/\bitalian[oa]\b/, 'Itália'],
  [/\bportugues(a)?\b/, 'Portugal'],
  [/\buruguai[oa]\b/, 'Uruguai'],
  [/\bfrances(a)?\b/, 'França'],
  [/\bespanhol(a)?\b/, 'Espanha'],
  [/\bsul[- ]?african[oa]\b/, 'África do Sul'],
  [/\b(american[oa]|californian[oa])\b/, 'Estados Unidos'],
  [/\baustralian[oa]\b/, 'Austrália'],
  [/\balema[oa]\b/, 'Alemanha'],
  [/\bneozelandes(a)?\b/, 'Nova Zelândia'],
]

// Grafia de exibicao; a busca e sem acento.
const GRAPES = [
  'Cabernet Sauvignon', 'Cabernet Franc', 'Sauvignon Blanc', 'Pinot Noir', 'Pinot Grigio', 'Touriga Nacional', 'Alicante Bouschet',
  'Malbec', 'Merlot', 'Carménère', 'Syrah', 'Shiraz', 'Tannat', 'Chardonnay', 'Torrontés', 'Sangiovese', 'Primitivo', 'Tempranillo',
  'Moscato', 'Moscatel', 'Bonarda', 'Riesling', 'Gewürztraminer', 'Nebbiolo', 'Montepulciano', 'Lambrusco', 'Garnacha', 'Grenache',
  'Viognier', 'Petit Verdot', 'Zinfandel', 'Pinotage', 'Glera', 'Alvarinho', 'Albariño', 'Arinto', 'Aragonez', 'Trincadeira',
  'Isabel', 'Bordô', 'Niágara',
]
const GRAPE_KEYS = GRAPES.map((g) => [norm(g), g] as const).sort((a, b) => b[0].length - a[0].length)

const typeFromV3 = (c3?: string | null): WineFacts['tipo'] => {
  const v = norm(String(c3 || ''))
  if (v.includes('espumante') || v.includes('champan')) return 'espumante'
  if (v.includes('rose')) return 'rosé'
  if (v.includes('branco')) return 'branco'
  if (v.includes('tinto')) return 'tinto'
  if (v.includes('licoroso') || v.includes('fortificado') || v.includes('porto')) return 'fortificado'
  return null
}

const typeFromName = (name: string): WineFacts['tipo'] => {
  const n = norm(name)
  if (/\b(espumante|prosecco|champagne|cava|frisante|lambrusco)\b/.test(n)) return 'espumante'
  if (/\brose\b/.test(n)) return 'rosé'
  if (/\bbranco\b/.test(n)) return 'branco'
  if (/\btinto\b/.test(n)) return 'tinto'
  if (/\b(porto|licoroso|madeira|marsala|jerez)\b/.test(n)) return 'fortificado'
  return null
}

const styleFromName = (name: string): WineFacts['estilo'] => {
  const n = norm(name)
  if (/\b(zero|sem) alcool\b/.test(n)) return 'sem álcool'
  if (/\bextra[- ]?brut\b/.test(n)) return 'extra-brut'
  if (/\bnature\b/.test(n)) return 'nature'
  if (/\bbrut\b/.test(n)) return 'brut'
  if (/\bdemi[- ]?sec\b/.test(n)) return 'demi-sec'
  if (/\bmeio[- ]?seco\b/.test(n)) return 'meio-seco'
  if (/\bsuave\b/.test(n)) return 'suave'
  if (/\bseco\b/.test(n)) return 'seco'
  return null
}

export function wineFacts(product: Pick<Product, 'name'> & { wineProfile?: WineProfile | null; classification03?: string | null }): WineFacts {
  const p = product.wineProfile || null
  const name = product.name || ''
  const n = norm(name)
  const country = COUNTRY_BY_ADJECTIVE.find(([re]) => re.test(n))?.[1] ?? null
  const grapes: string[] = []
  let rest = n
  for (const [key, label] of GRAPE_KEYS) {
    if (rest.includes(key)) {
      grapes.push(label)
      rest = rest.replace(key, ' ')
    }
  }
  return {
    tipo: p?.tipo ?? typeFromV3(product.classification03) ?? typeFromName(name),
    estilo: p?.estilo ?? styleFromName(name),
    pais: p?.pais || country,
    uvas: p?.uvas?.length ? p.uvas : grapes,
    regiao: p?.regiaoDenominacao || null,
    produtor: p?.produtor || null,
    curado: Boolean(p),
  }
}

export const WINE_TYPE_LABEL: Record<NonNullable<WineFacts['tipo']>, string> = {
  tinto: 'Tinto', branco: 'Branco', 'rosé': 'Rosé', espumante: 'Espumante', fortificado: 'Fortificado', sobremesa: 'Sobremesa',
}
export const WINE_STYLE_LABEL: Record<NonNullable<WineFacts['estilo']>, string> = {
  seco: 'Seco', 'meio-seco': 'Meio-seco', suave: 'Suave', brut: 'Brut', 'extra-brut': 'Extra-brut', nature: 'Nature', 'demi-sec': 'Demi-sec', 'sem álcool': 'Sem álcool',
}

/** "Malbec · Argentina" / "Blend · Itália" / "Espumante · Brasil". */
export function wineSubtitle(f: WineFacts): string {
  const grape = f.uvas.length > 2 ? 'Blend' : f.uvas.join(' & ')
  return [grape || (f.tipo ? WINE_TYPE_LABEL[f.tipo] : ''), f.regiao && f.pais ? `${f.regiao}, ${f.pais}` : f.pais].filter(Boolean).join(' · ')
}

export const PRICE_BANDS = [
  { key: 'ate60', label: 'Até R$ 60', min: 0, max: 60 },
  { key: '60a120', label: 'R$ 60 a 120', min: 60, max: 120 },
  { key: '120a200', label: 'R$ 120 a 200', min: 120, max: 200 },
  { key: '200mais', label: 'Acima de R$ 200', min: 200, max: Infinity },
] as const
