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
