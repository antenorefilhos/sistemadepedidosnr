import type { Product } from '../types'
import { formatPortionFromStep, getFractionDisplayUnit, getProductStep } from './productPricing'

// Pagina do produto so mostra o que e verdade SOBRE ESTE produto. Ate
// 27/09/2026 ela montava secoes genericas (estoque, EAN, "categoria
// comercial", "harmoniza com carnes vermelhas" ate para vinho branco) --
// informacao de sistema, nao de produto. Regra: se o dado nao existe no
// cadastro, a linha nao aparece.

export type ProductFact = { label: string; value: string }

export type ProductDetailSection = {
  id: 'wine' | 'meat' | 'info' | 'storage'
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

// Harmonizacao classica por uva (a primeira uva do nome decide); sem uva, pelo tipo.
const PAIRING_BY_GRAPE: Record<string, string> = {
  'cabernet sauvignon': 'Carnes vermelhas grelhadas, cordeiro e queijos curados',
  'cabernet franc': 'Carnes assadas, pratos com ervas e queijos de média cura',
  merlot: 'Massas ao molho vermelho, carnes assadas e queijos de média cura',
  malbec: 'Churrasco, cortes gordos e carnes na brasa',
  syrah: 'Carnes condimentadas, embutidos e costela',
  shiraz: 'Carnes condimentadas, embutidos e costela',
  tannat: 'Carnes gordas, costela e cordeiro',
  carmenere: 'Carnes com especiarias, pimentões e comida mexicana',
  'pinot noir': 'Aves, salmão, cogumelos e massas leves',
  sangiovese: 'Massas ao sugo, pizza e antepastos',
  tempranillo: 'Embutidos, cordeiro e presunto cru',
  'touriga nacional': 'Carnes assadas, cabrito e bacalhau no forno',
  pinotage: 'Carnes defumadas e churrasco',
  chardonnay: 'Peixes, frutos do mar, aves e queijos cremosos',
  'sauvignon blanc': 'Saladas, frutos do mar, ceviche e queijo de cabra',
  moscatel: 'Sobremesas, frutas e doces',
  riesling: 'Comida asiática, peixes e pratos agridoces',
}
const PAIRING_BY_TYPE: Record<string, string> = {
  Tinto: 'Carnes vermelhas, massas ao molho vermelho e queijos curados',
  Branco: 'Peixes, frutos do mar, aves e saladas',
  Rosé: 'Saladas, peixes, pratos leves e petiscos',
  Espumante: 'Entradas, frutos do mar, petiscos e brindes',
}

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

  const sweet = sweetness === 'suave' || sweetness === 'doce'
  const pairing = sweet ? 'Sobremesas, frutas e pratos agridoces' : uniqueGrapes.map((g) => PAIRING_BY_GRAPE[strip(g).replace('carménère', 'carmenere')]).find(Boolean) || (type ? PAIRING_BY_TYPE[type] : undefined)
  if (pairing) facts.push({ label: 'Harmoniza com', value: pairing })

  if (type && SERVING_TEMPERATURE[type]) facts.push({ label: 'Servir entre', value: SERVING_TEMPERATURE[type] })

  return facts
}

// Preparo indicado por corte (palavra do nome do cadastro). Ordem importa:
// "contra file" antes de "file", "file mignon" antes de "file".
const MEAT_CUTS: Array<[RegExp, string]> = [
  [/picanha/, 'Churrasco e grelha (em peça ou em bifes grossos)'],
  [/file de costela|steak/, 'Grelha e chapa (steak)'],
  [/maminha|fraldinha|fraldao|vazio|entranha|flat iron|denver|ancho|chorizo|ojo de bife|short rib|tomahawk/, 'Churrasco e grelha'],
  [/contra ?file/, 'Grelha, churrasco e bife na chapa'],
  [/file mignon/, 'Medalhões, bife alto, estrogonofe e carpaccio'],
  [/alcatra|miolo da alcatra|baby beef/, 'Churrasco, bifes e assados'],
  [/costela|cupim/, 'Fogo de chão, forno baixo e panela de pressão (cozimento longo)'],
  [/patinho|coxao|lagarto/, 'Bife, carne moída, assado de panela e rosbife'],
  [/acem|musculo|paleta|peito bovino|ossobuco/, 'Panela: ensopados, caldos e carne desfiada'],
  [/moida/, 'Molhos, almôndegas, recheios e hambúrguer'],
  [/linguica/, 'Churrasco, frigideira e forno'],
  [/\b(asa|coxa|sobrecoxa|drumet|tulipa)\b/, 'Churrasco, forno e airfryer'],
  [/peito de frango|file de peito|file de frango/, 'Grelhado, empanado, desfiado e estrogonofe'],
  [/pernil|lombo/, 'Forno (assado) e churrasco'],
  [/costelinha|barriga|panceta|torresmo/, 'Forno baixo, churrasco e pururuca'],
  [/cordeiro|carre|cabrito/, 'Grelha e forno'],
]

const buildMeat = (product: Product): ProductFact[] => {
  const name = strip(product.name)
  const facts: ProductFact[] = []
  const cut = MEAT_CUTS.find(([re]) => re.test(name))
  if (cut) facts.push({ label: 'Indicado para', value: cut[1] })
  if (product.isFractional) {
    facts.push({ label: 'Quanto comprar', value: 'Churrasco: cerca de 400 g por adulto. Prato do dia a dia: 150 g a 200 g por pessoa.' })
  }
  return [...facts, ...buildInfo(product)]
}

/**
 * Nota de fracionamento do ERP (alternativeDescription) em linguagem de
 * cliente: "Fracionamento: Peso aproximado / 1und." -> "cerca de 1 unidade".
 * O aviso generico ("Precos de produtos pesaveis podem sofrer variacao") fica
 * de fora: a pagina ja explica a venda por peso. Ate 07/10/2026 o texto cru
 * aparecia numa caixa abaixo do titulo.
 */
export const fractionNote = (text?: string | null): string => {
  const raw = String(text || '').replace(/^\s*fracionamento\s*:\s*/i, '').trim().replace(/[.\s]+$/, '')
  if (!raw || /sofrer varia/i.test(raw)) return ''
  const approx = raw.match(/^peso aproximado\s*\/\s*(.+)$/i)
  if (!approx && /^peso aproximado$/i.test(raw)) return ''
  const body = (approx ? approx[1] : raw)
    .toLocaleLowerCase('pt-BR')
    .replace(/(\d+)\s*und?\b\.?/g, (_, n: string) => `${n} ${n === '1' ? 'unidade' : 'unidades'}`)
  return approx && /^\d/.test(body) ? `cerca de ${body}` : body
}

const buildInfo = (product: Product): ProductFact[] => {
  const facts: ProductFact[] = []
  // Venda por peso e tamanho da porcao ja aparecem junto do botao de comprar;
  // aqui so entra o que a ficha acrescenta: quanto a porcao rende.
  if (product.isFractional) {
    const portion = formatPortionFromStep(getProductStep(product), getFractionDisplayUnit(product))
    const note = fractionNote(product.alternativeDescription)
    if (note) facts.push({ label: 'Cada porção', value: `${portion} (${note})` })
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
    // Com a ficha curada (wineProfile), o bloco "Sobre este vinho" ja mostra
    // tudo isso, com mais precisao: nao repete (03/10/2026).
    const wine = product.wineProfile ? [] : getWineFacts(product)
    if (wine.length) sections.push({ id: 'wine', title: 'Ficha do vinho', facts: wine })
  } else if (product.category === 'ACOUGUE_CHURRASCO') {
    const meat = buildMeat(product)
    if (meat.length) sections.push({ id: 'meat', title: 'Sobre este corte', facts: meat })
  } else {
    const info = buildInfo(product)
    if (info.length) sections.push({ id: 'info', title: 'Informações', facts: info })
  }
  const storage = STORAGE_BY_CATEGORY[String(product.category || '')]
  if (storage) sections.push({ id: 'storage', title: 'Conservação', facts: [{ label: '', value: storage }] })
  return sections
}
