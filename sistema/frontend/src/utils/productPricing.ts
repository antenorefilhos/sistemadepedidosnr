import type { Product } from '../types'
import { formatPrice, formatPriceParts } from './format'

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function roundCurrency(value: number) {
  return roundTo(value, 2)
}

export function normalizeFractionUnit(unit?: string) {
  const raw = (unit || '').trim().toLowerCase()

  if (!raw || /^\d+$/.test(raw)) {
    return 'un'
  }
  if (['quilo', 'kilo', 'kgs'].includes(raw)) return 'kg'
  if (['grama', 'gramas'].includes(raw)) return 'g'
  if (['unidade', 'und'].includes(raw)) return 'un'
  if (['litro', 'litros', 'lt'].includes(raw)) return 'l'

  return raw
}

export function getFractionDisplayUnit(product: Pick<Product, 'isFractional' | 'unit'>) {
  const normalized = normalizeFractionUnit(product.unit)

  if (product.isFractional && normalized === 'un') {
    // Fallback operacional para manter consistencia visual enquanto o ERP nao envia emb legivel.
    return 'kg'
  }

  return normalized
}

export function formatPortionFromStep(step: number, unitLabel: string) {
  const normalizedStep = roundTo(step, 6)

  if (unitLabel === 'kg') {
    if (normalizedStep < 1) return `${Math.round(normalizedStep * 1000)} g`
    if (Number.isInteger(normalizedStep)) return `${normalizedStep} kg`
    return `${normalizedStep.toString().replace('.', ',')} kg`
  }

  if (unitLabel === 'g') {
    if (normalizedStep >= 1000) return `${roundTo(normalizedStep / 1000, 3).toString().replace('.', ',')} kg`
    return `${Math.round(normalizedStep)} g`
  }

  if (unitLabel === 'ml') {
    if (normalizedStep >= 1000) return `${roundTo(normalizedStep / 1000, 3).toString().replace('.', ',')} l`
    return `${Math.round(normalizedStep)} ml`
  }

  if (unitLabel === 'l') {
    if (Number.isInteger(normalizedStep)) return `${normalizedStep} l`
    return `${normalizedStep.toString().replace('.', ',')} l`
  }

  if (Number.isInteger(normalizedStep)) return `${normalizedStep} ${unitLabel}`
  return `${normalizedStep.toString().replace('.', ',')} ${unitLabel}`
}

function hasPromotionalPrice(product: Product) {
  return typeof product.promotionalPrice === 'number' && product.promotionalPrice > 0 && product.promotionalPrice < product.price
}

// INVARIANTE: isFractional vem EXCLUSIVAMENTE do campo `fracionado` do ERP (booleano).
// Nunca inferir fracionamento por nome, unidade ou descrição — isso corrompe precificação.
// Produtos pesáveis precisam de fractionStep persistido; sem ele, não inventar porção de 100g.
export function hasConfiguredFractionStep(product: Pick<Product, 'isFractional' | 'fractionStep'>) {
  return !product.isFractional || (typeof product.fractionStep === 'number' && product.fractionStep > 0)
}

export function getProductStep(
  product: Pick<Product, 'isFractional' | 'fractionStep' | 'unit'>,
) {
  if (!product.isFractional) return 1

  const rawStep = typeof product.fractionStep === 'number' && product.fractionStep > 0 ? product.fractionStep : null
  if (rawStep !== null) return rawStep

  return 1
}

export function getProductUnitPrice(product: Product) {
  return hasPromotionalPrice(product) ? product.promotionalPrice! : product.price
}

export function getProductDisplayPrice(product: Product) {
  return roundCurrency(getProductUnitPrice(product) * getProductStep(product))
}

export function getProductLineTotal(product: Product, quantity: number) {
  return roundCurrency(getProductDisplayPrice(product) * quantity)
}

/** Quanto o item economiza por estar em promocao (preco cheio - preco de
 * exibicao, ja aplicado no subtotal). So existe pra dar visibilidade ao
 * cliente -- subtotal/total do carrinho ja usam o preco promocional, entao
 * isso NUNCA e subtraido de novo do total, e so exibido como "Desconto". */
export function getProductPromoSavings(product: Product, quantity: number) {
  if (!hasPromotionalPrice(product)) return 0
  const regularLineTotal = roundCurrency(product.price * getProductStep(product) * quantity)
  return Math.max(0, regularLineTotal - getProductLineTotal(product, quantity))
}

export function formatProductQuantity(product: Product, quantity: number) {
  if (!product.isFractional) return `${quantity}`

  const unitLabel = getFractionDisplayUnit(product)
  const preciseQuantity = roundTo(quantity * getProductStep(product), 6)
  return formatPortionFromStep(preciseQuantity, unitLabel)
}

export function getProductPricePresentation(product: Product) {
  const unitLabel = getFractionDisplayUnit(product)
  const step = getProductStep(product)
  const missingFractionStep = product.isFractional && !hasConfiguredFractionStep(product)
  const unitPrice = getProductUnitPrice(product)
  const displayPrice = roundCurrency(unitPrice * step)
  const portionLabel = missingFractionStep ? '' : formatPortionFromStep(step, unitLabel)
  const suffix = product.isFractional
    ? missingFractionStep
      ? (unitLabel !== 'un' ? `/${unitLabel}` : '')
      : (unitLabel !== 'un' ? `/${portionLabel}` : '')
    : '/un'
  const referenceText = product.isFractional
    ? missingFractionStep
      ? 'Fracionamento pendente'
      : (unitLabel !== 'un' ? `${formatPrice(unitPrice)}/${unitLabel}` : '')
    : ''
  const parts = formatPriceParts(displayPrice)

  return {
    currencySymbol: parts.currencySymbol,
    value: parts.value,
    suffix,
    fullLabel: suffix ? `${parts.currencySymbol} ${parts.value} ${suffix}` : `${parts.currencySymbol} ${parts.value}`,
    portionLabel,
    referenceText,
    unitLabel,
    step,
    displayPrice,
    unitPrice,
  }
}

/**
 * Tamanho da embalagem lido do nome ("500 g", "1,5 L", "4 x 90 g", "10 un"),
 * numa linha propria do card (08/10/2026): o nome corta em duas linhas e a
 * medida, que fica no fim, sumia -- o Cafe Pilao 250g e o 500g ficavam iguais.
 * Pesavel fica de fora: o preco ja diz a porcao.
 */
export function getPackageSize(product: Pick<Product, 'name' | 'isFractional'>): string {
  if (product.isFractional) return ''
  const name = product.name || ''
  const num = (v: string) => Number(v.replace(',', '.')).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  const unit = (u: string) => {
    const lower = u.toLowerCase()
    if (lower === 'kg' || lower === 'g' || lower === 'ml') return lower
    return 'L'
  }
  const multi = name.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s?(kg|g|ml|l|lt)\b/i)
  if (multi) return `${multi[1]} x ${num(multi[2])} ${unit(multi[3])}`
  const measure = [...name.matchAll(/(\d+(?:[.,]\d+)?)\s?(kg|g|ml|l|lt|litros?)\b/gi)].pop()
  if (measure) return `${num(measure[1])} ${unit(measure[2])}`
  const units = name.match(/(\d+)\s*(?:unidades|unid|un)\b/i)
  if (units && Number(units[1]) > 1) return `${units[1]} un`
  return ''
}

/**
 * Preco por unidade de medida ("R$ 91,60/kg", "R$ 5,99/L") para comparar
 * embalagens, como a gondola e os apps de supermercado mostram (Decreto
 * 5.903/2006). Pesavel ja tem o preco do kg. Embalagem multipla ("4x90g",
 * "Pack", "Kit", "6 Unidades") fica de fora: o conteudo do nome nao e o total.
 * Embalagem de 1 kg / 1 L tambem: o preco ja e o da unidade de medida.
 */
export function getUnitReference(product: Product): string {
  if (product.isFractional) return getProductPricePresentation(product).referenceText
  const name = product.name || ''
  if (/\d\s*x\s*\d|\bpack\b|\bkit\b|\bleve\s*\d|\d+\s*unidades\b/i.test(name)) return ''
  const match = [...name.matchAll(/(\d+(?:[.,]\d+)?)\s?(kg|g|ml|l|lt|litros?)\b/gi)].pop()
  if (!match) return ''
  const amount = Number(match[1].replace(',', '.'))
  const unit = match[2].toLowerCase()
  const base = unit === 'kg' || unit.startsWith('l') ? amount : amount / 1000
  if (!(base > 0) || base === 1) return ''
  return `${formatPrice(getProductUnitPrice(product) / base)}/${unit === 'kg' || unit === 'g' ? 'kg' : 'L'}`
}
