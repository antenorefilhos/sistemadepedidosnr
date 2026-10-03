import type { Product } from '../types'
import { isSoldOnWeekday, normalizeSaleWeekdays, saleDaysLabel, saleDaysShort } from './saleDays'
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
  badgeVariant: 'default' | 'urgent' | 'promo' | 'frozen' | 'pet' | 'tobacco' | 'top' | 'label'
  discountPct: number
  ctaLabel: string
  isFractional: boolean
  isOnSale: boolean
  outOfStock: boolean
  /** Motivo do `outOfStock`: cadastro sem porcao, nao falta de estoque. */
  missingFractionStep: boolean
  /** Motivo do `outOfStock`: hoje nao e dia de venda do produto (ex.: pizza so de quinta a domingo). */
  offDay: boolean
  /** "de quinta a domingo" quando o produto tem dias de venda; vazio quando vende todo dia. */
  saleDaysText: string
  /** Selo sobre a foto quando nao da para comprar: "Indisponível" ou "Só qui a dom". */
  unavailableLabel: string
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

export function getProductCardViewModel(product: Product, saleWeekday?: number): ProductCardViewModel {
  const unitLabel = getFractionDisplayUnit(product)
  const fractionDetails = parseFractionDetails(product.alternativeDescription)
  const hasPromotionalPrice =
    typeof product.promotionalPrice === 'number' &&
    product.promotionalPrice > 0 &&
    product.promotionalPrice < product.price

  const step = getProductStep(product)
  const missingFractionStep = product.isFractional && !hasConfiguredFractionStep(product)
  const offDay = saleWeekday !== undefined && !isSoldOnWeekday(product, saleWeekday)
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
  // Etiqueta escolhida no admin (Produtos > produto > "Etiqueta no card"). Ate
  // 03/10/2026 so um texto com "TOP" virava selo: o admin grava "Mais Vendido",
  // "Importado", "Premium"... e nenhuma aparecia no card.
  const adminLabel = String(product.badges || '').trim()
  const isTopSeller = /^mais vendido$/i.test(adminLabel) || adminLabel.toUpperCase().includes('TOP')

  let badgeText = ''
  let badgeVariant: ProductCardViewModel['badgeVariant'] = 'default'

  if (isLowStockByIntegration) {
    badgeText = hasPromotionalPrice ? 'Oferta acabando' : 'Tá acabando'
    badgeVariant = 'urgent'
  } else if (hasPromotionalPrice) {
    badgeText = 'Promoção'
    badgeVariant = 'promo'
  } else if (isTopSeller) {
    badgeText = '🔥 Mais vendido'
    badgeVariant = 'top'
  } else if (adminLabel) {
    badgeText = adminLabel
    badgeVariant = 'label'
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
        ? 'Pesável sem porção configurada'
        : `Porção mínima de ${portionLabel}`
      : '',
    helperText: helperChunks.join(' • '),
    currentPrice,
    originalPrice,
    referenceText,
    badgeText,
    badgeVariant,
    discountPct,
    ctaLabel: missingFractionStep ? 'Indisponível' : (product.isFractional ? 'Adicionar porção' : 'Adicionar'),
    isFractional: Boolean(product.isFractional),
    isOnSale: hasPromotionalPrice,
    outOfStock: missingFractionStep || (product.syncOption !== 'SEMPRE' && stockValue <= 0) || offDay,
    /** Distingue o motivo de `outOfStock`: cadastro incompleto, nao falta de
     *  estoque. Exposto para a UI nao ter que comparar o texto do `ctaLabel`. */
    missingFractionStep: Boolean(missingFractionStep),
    offDay,
    saleDaysText: normalizeSaleWeekdays(product.saleWeekdays).length ? saleDaysLabel(product.saleWeekdays) : '',
    unavailableLabel: offDay ? `Só ${saleDaysShort(product.saleWeekdays)}` : 'Indisponível',
  }
}
