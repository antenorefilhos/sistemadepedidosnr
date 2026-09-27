import type { Product } from '../types'
import { formatPortionFromStep, getFractionDisplayUnit, getProductStep } from './productPricing'

// Pagina do produto so mostra o que e verdade SOBRE ESTE produto. Ate
// 27/09/2026 ela montava secoes genericas (estoque, EAN, "categoria
// comercial", "harmoniza com carnes vermelhas" ate para vinho branco) --
// informacao de sistema, nao de produto. Regra: se o dado nao existe no
// cadastro, a linha nao aparece.

export type ProductFact = { label: string; value: string }

export type ProductDetailSection = {
  id: 'wine' | 'info' | 'storage'
  title: string
  facts: ProductFact[]
}

const strip = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// Adjetivo de origem usado no nome do cadastro -> pais.
const WINE_COUNTRIES: Record<string, string> = {
  nacional: 'Brasil',
  brasileiro: 'Brasil',
  chileno: 'Chile',
  argentino: 'Argentina',
  uruguaio: 'Uruguai',
  portugues: 'Portugal',
  italiano: 'Itália',
  frances: 'França',
  espanhol: 'Espanha',
  alemao: 'Alemanha',
  americano: 'Estados Unidos',
  africano: 'África do Sul',
  'sul-africano': 'África do Sul',
  australiano: 'Austrália',
  neozelandes: 'Nova Zelândia',
}

const GRAPES = [
  'Cabernet Sauvignon', 'Cabernet Franc', 'Sauvignon Blanc', 'Pinot Noir', 'Pinot Grigio', 'Touriga Nacional',
  'Petit Verdot', 'Chardonnay', 'Merlot', 'Malbec', 'Syrah', 'Shiraz', 'Tannat', 'Carmenere', 'Carménère',
  'Tempranillo', 'Sangiovese', 'Moscatel', 'Riesling', 'Pinotage', 'Zinfandel', 'Primitivo', 'Nebbiolo',
  'Montepulciano', 'Bonarda', 'Teroldego', 'Torrontes', 'Alvarinho', 'Garnacha', 'Grenache', 'Marselan',
]

const WINE_TYPES: Record<string, string> = { tinto: 'Tinto', branco: 'Branco', rose: 'Rosé' }

const SERVING_TEMPERATURE: Record<string, string> = {
  Tinto: '16 °C a 18 °C',
  Branco: '8 °C a 10 °C',
  Rosé: '8 °C a 12 °C',
  Espumante: '6 °C a 8 °C',
}

const isWine = (product: Product) =>
  product.category === 'ADEGA_VINHOS_ESPUMANTES' || /^(vinho|espumante|champagne)\b/.test(strip(product.name))

/** Ficha do vinho extraida do nome padronizado do cadastro (tipo, pais, uva, volume). */
export const getWineFacts = (product: Product): ProductFact[] => {
  const words = product.name.split(/\s+/)
  const lower = words.map(strip)
  const facts: ProductFact[] = []

  const isSparkling = lower[0] === 'espumante' || lower[0] === 'champagne'
  const type = isSparkling ? 'Espumante' : WINE_TYPES[lower[1]]
  if (type) facts.push({ label: 'Tipo', value: type })

  const country = lower.map((w) => WINE_COUNTRIES[w]).find(Boolean)
  if (country) facts.push({ label: 'País', value: country })

  const name = strip(product.name)
  const grapes = GRAPES.filter((grape) => name.includes(strip(grape)))
  const uniqueGrapes = grapes.filter((g, i) => grapes.findIndex((o) => strip(o) === strip(g)) === i)
  if (uniqueGrapes.length) facts.push({ label: uniqueGrapes.length > 1 ? 'Uvas' : 'Uva', value: uniqueGrapes.join(', ') })

  const sweetness = ['seco', 'suave', 'demi-sec', 'brut', 'nature', 'doce'].find((s) => lower.includes(s))
  if (sweetness) facts.push({ label: 'Estilo', value: sweetness === 'demi-sec' ? 'Demi-sec' : sweetness[0].toUpperCase() + sweetness.slice(1) })

  if (/\bgran reserva\b/.test(name)) facts.push({ label: 'Classificação', value: 'Gran Reserva' })
  else if (/\breserva\b/.test(name)) facts.push({ label: 'Classificação', value: 'Reserva' })

  const volume = product.name.match(/(\d+(?:[.,]\d+)?)\s?(ml|l)\b/i)
  if (volume) facts.push({ label: 'Volume', value: `${volume[1]} ${volume[2].toLowerCase() === 'l' ? 'L' : 'ml'}` })

  if (type && SERVING_TEMPERATURE[type]) facts.push({ label: 'Servir entre', value: SERVING_TEMPERATURE[type] })

  return facts
}

const buildInfo = (product: Product): ProductFact[] => {
  const facts: ProductFact[] = []
  if (product.isFractional) {
    const portion = formatPortionFromStep(getProductStep(product), getFractionDisplayUnit(product))
    facts.push({ label: 'Venda', value: 'Por peso, pesado na hora da separação' })
    facts.push({ label: 'Porção mínima', value: portion })
  }
  const content = product.name.match(/(\d+(?:[.,]\d+)?)\s?(kg|g|ml|l|un|unidades)\b/i)
  if (!product.isFractional && content) facts.push({ label: 'Conteúdo', value: `${content[1]} ${content[2]}` })
  if (product.origin) facts.push({ label: 'Origem', value: product.origin })
  return facts
}

const STORAGE_BY_CATEGORY: Record<string, string> = {
  ACOUGUE_CHURRASCO: 'Manter refrigerado entre 0 °C e 4 °C. Se não for consumir no dia, congele.',
  CONGELADOS_PRATICOS: 'Manter congelado a -18 °C ou menos. Não recongele depois de descongelado.',
  QUEIJOS_FRIOS_LATICINIOS: 'Manter refrigerado. Depois de aberto, consumir conforme a embalagem.',
}

export const getProductDetailSections = (product: Product): ProductDetailSection[] => {
  const sections: ProductDetailSection[] = []
  if (isWine(product)) {
    const wine = getWineFacts(product)
    if (wine.length) sections.push({ id: 'wine', title: 'Ficha do vinho', facts: wine })
  } else {
    const info = buildInfo(product)
    if (info.length) sections.push({ id: 'info', title: 'Informações', facts: info })
  }
  const storage = STORAGE_BY_CATEGORY[String(product.category || '')]
  if (storage) sections.push({ id: 'storage', title: 'Conservação', facts: [{ label: '', value: storage }] })
  return sections
}
