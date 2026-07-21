import type { Product } from '../types'
import {
  formatPortionFromStep,
  getFractionDisplayUnit,
  getProductPricePresentation,
  getProductStep,
  hasConfiguredFractionStep,
} from './productPricing'

type FractionDetails = {
  fractionText: string
  portionText: string
  weightText: string
}

function isUnitaryFractionValue(value: string) {
  return /^1([.,]0+)?(\s*(un|und|unidade|unidades))?$/i.test(value.trim())
}

export type ProductCardViewModel = {
  title: string
  eyebrow: string
  helperText: string
  currentPrice: number
  originalPrice: number | null
  referenceText: string
  badgeText: string
  badgeVariant: 'default' | 'urgent' | 'promo' | 'frozen' | 'pet' | 'tobacco' | 'top'
  discountPct: number
  ctaLabel: string
  isFractional: boolean
  isOnSale: boolean
  outOfStock: boolean
}

export function parseFractionDetails(alternativeDescription?: string): FractionDetails {
  if (!alternativeDescription) {
    return { fractionText: '', portionText: '', weightText: '' }
  }

  const chunks = alternativeDescription
    .split('|')
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  let fractionText = ''
  let portionText = ''
  let weightText = ''

  for (const chunk of chunks) {
    const lower = chunk.toLowerCase()
    const value = (chunk.includes(':') ? chunk.split(':').slice(1).join(':') : chunk).trim()

    if (!fractionText && /fracionamento/.test(lower)) {
      fractionText = isUnitaryFractionValue(value) ? '' : value
      continue
    }

    if (!portionText && /(porcionamento|porcao|porção)/.test(lower)) {
      portionText = value
      continue
    }

    if (!weightText && /peso/.test(lower)) {
      weightText = value
    }
  }

  return {
    fractionText,
    portionText,
    weightText,
  }
}

export function getProductCardViewModel(product: Product): ProductCardViewModel {
  const unitLabel = getFractionDisplayUnit(product)
  const fractionDetails = parseFractionDetails(product.alternativeDescription)
  const hasPromotionalPrice =
    typeof product.promotionalPrice === 'number' &&
    product.promotionalPrice > 0 &&
    product.promotionalPrice < product.price

  const step = getProductStep(product)
  const missingFractionStep = product.isFractional && !hasConfiguredFractionStep(product)
  const pricing = getProductPricePresentation(product)
  const currentPrice = pricing.displayPrice
  const originalPrice = hasPromotionalPrice ? product.price * step : null
  const portionLabel = missingFractionStep ? '' : (fractionDetails.portionText || formatPortionFromStep(step, unitLabel))
  const helperChunks = product.isFractional
    ? [
        missingFractionStep ? 'Fracionamento pendente no ERP' : '',
        fractionDetails.fractionText,
        fractionDetails.weightText,
      ].filter(Boolean)
    : []
  const referenceText = pricing.referenceText
  const discountPct = hasPromotionalPrice
    ? Math.round((1 - product.promotionalPrice! / product.price) * 100)
    : 0
  const stockValue = Number(product.stock || 0)
  const isLowStockByIntegration = product.syncOption === 'ESTOQUE' && stockValue > 0 && stockValue < 5

  const category = (product.category || '').toUpperCase()
  const isFrozen = category === 'CONGELADOS'
  const isPet = category === 'PET_SHOP'
  const isTobacco = category === 'TABACARIA'
  const isTopSeller = (product.badges || '').toUpperCase().includes('TOP')

  let badgeText = ''
  let badgeVariant: ProductCardViewModel['badgeVariant'] = 'default'

  if (isLowStockByIntegration) {
    badgeText = hasPromotionalPrice ? '🚨 Oferta acabando' : '🚨 Ta acabando'
    badgeVariant = 'urgent'
  } else if (hasPromotionalPrice) {
    badgeText = '🤑 Promoção'
    badgeVariant = 'promo'
  } else if (isTopSeller) {
    badgeText = '🔥 Mais vendido'
    badgeVariant = 'top'
  } else if (isFrozen) {
    badgeText = '❄️ Congelado'
    badgeVariant = 'frozen'
  } else if (isPet) {
    badgeText = '🐶 Pet'
    badgeVariant = 'pet'
  } else if (isTobacco) {
    badgeText = '🔞'
    badgeVariant = 'tobacco'
  }

  return {
    title: product.name,
    eyebrow: product.isFractional
      ? missingFractionStep
        ? 'Pesavel sem porcao configurada'
        : `Porção mínima de ${portionLabel}`
      : '',
    helperText: helperChunks.join(' • '),
    currentPrice,
    originalPrice,
    referenceText,
    badgeText,
    badgeVariant,
    discountPct,
    ctaLabel: missingFractionStep ? 'Indisponivel' : (product.isFractional ? 'Adicionar porção' : 'Adicionar'),
    isFractional: Boolean(product.isFractional),
    isOnSale: hasPromotionalPrice,
    outOfStock: missingFractionStep || (product.syncOption !== 'SEMPRE' && stockValue <= 0),
  }
}
