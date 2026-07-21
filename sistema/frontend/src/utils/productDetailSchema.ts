import type { Product } from '../types'
import { formatPortionFromStep, getFractionDisplayUnit, getProductStep } from './productPricing'

export type ProductDetailSectionType =
  | 'summary'
  | 'attributes'
  | 'additionalInfo'
  | 'storage'
  | 'cutTips'
  | 'harmonization'

export type ProductDetailSection = {
  id: ProductDetailSectionType
  title: string
  paragraphs: string[]
}

const DEFAULT_TITLES: Record<ProductDetailSectionType, string> = {
  summary: 'Resumo do produto',
  attributes: 'Atributos principais',
  additionalInfo: 'Informacoes adicionais',
  storage: 'Conservacao',
  cutTips: 'Dicas de preparo',
  harmonization: 'Harmonizacao sugerida',
}

const SCHEMA_BY_CATEGORY: Record<string, ProductDetailSectionType[]> = {
  VINHOS: ['summary', 'attributes', 'harmonization', 'additionalInfo', 'storage'],
  CERVEJAS: ['summary', 'attributes', 'harmonization', 'additionalInfo', 'storage'],
  CHURRASCO: ['summary', 'attributes', 'cutTips', 'additionalInfo', 'storage'],
  CARNES_DIA_A_DIA: ['summary', 'attributes', 'cutTips', 'additionalInfo', 'storage'],
  HORTIFRUTI: ['summary', 'attributes', 'additionalInfo', 'storage'],
  PADARIA: ['summary', 'attributes', 'additionalInfo', 'storage'],
}

const normalizeCategory = (value?: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const buildSummary = (product: Product) => {
  const lines = [
    product.alternativeDescription || `Produto da categoria ${String(product.category || 'geral').toLowerCase().replace(/_/g, ' ')}.`,
  ]

  if (product.badges) {
    lines.push(`Destaques comerciais: ${product.badges}.`)
  }

  return lines
}

const buildAttributes = (product: Product) => {
  const lines: string[] = []

  const unitLabel = getFractionDisplayUnit(product)
  const step = getProductStep(product)
  const portionLabel = formatPortionFromStep(step, unitLabel)

  lines.push(`Unidade de venda: ${(product.unit || 'un').toUpperCase()}.`)

  if (product.isFractional) {
    lines.push(`Produto pesavel com porcao minima de ${portionLabel}.`)
  }

  if (typeof product.stock === 'number') {
    lines.push(`Estoque informado: ${product.stock}.`)
  }

  if (product.origin) {
    lines.push(`Origem: ${product.origin}.`)
  }

  return lines
}

const buildStorage = (product: Product) => {
  if (product.category === 'VINHOS' || product.category === 'CERVEJAS') {
    return ['Manter em local fresco e protegido de luz direta.', 'Refrigerar antes de servir quando aplicavel.']
  }

  if (product.category === 'CHURRASCO' || product.category === 'CARNES_DIA_A_DIA') {
    return ['Manter refrigerado entre 0C e 4C.', 'Se nao for consumir no dia, conservar congelado.']
  }

  return ['Conservar conforme orientacao da embalagem.', 'Apos aberto, manter em recipiente fechado.']
}

const buildAdditionalInfo = (product: Product) => {
  const lines: string[] = []

  if (product.ean) {
    lines.push(`EAN: ${product.ean}.`)
  }

  if (product.category) {
    lines.push(`Categoria comercial: ${String(product.category).replace(/_/g, ' ')}.`)
  }

  if (product.badges) {
    lines.push(`Selo editorial ativo: ${product.badges}.`)
  }

  if (product.titleMask || product.titleMaskShort) {
    lines.push('Titulo de vitrine personalizado aplicado para comunicacao comercial.')
  }

  return lines
}

const buildCutTips = () => {
  return [
    'Para melhor resultado, tempere com antecedencia e respeite o tempo de descanso apos o preparo.',
    'Use fogo medio para preservar suculencia e textura.',
  ]
}

const buildHarmonization = (product: Product) => {
  if (product.category === 'VINHOS') {
    return ['Harmoniza bem com carnes vermelhas, massas e queijos curados.', 'Sirva na temperatura recomendada para o estilo do rotulo.']
  }

  if (product.category === 'CERVEJAS') {
    return ['Combina com petiscos, churrasco e sanduiches.', 'Sirva gelada para melhor experiencia.']
  }

  return ['Pode ser combinado com os itens mais vendidos da mesma categoria.']
}

export const getProductDetailSections = (product: Product): ProductDetailSection[] => {
  const categoryCode = normalizeCategory(product.category)
  const schema = SCHEMA_BY_CATEGORY[categoryCode] || ['summary', 'attributes', 'additionalInfo', 'storage']

  return schema
    .map((sectionType): ProductDetailSection => {
      if (sectionType === 'summary') {
        return { id: sectionType, title: DEFAULT_TITLES[sectionType], paragraphs: buildSummary(product) }
      }

      if (sectionType === 'attributes') {
        return { id: sectionType, title: DEFAULT_TITLES[sectionType], paragraphs: buildAttributes(product) }
      }

      if (sectionType === 'storage') {
        return { id: sectionType, title: DEFAULT_TITLES[sectionType], paragraphs: buildStorage(product) }
      }

      if (sectionType === 'additionalInfo') {
        return { id: sectionType, title: DEFAULT_TITLES[sectionType], paragraphs: buildAdditionalInfo(product) }
      }

      if (sectionType === 'cutTips') {
        return { id: sectionType, title: DEFAULT_TITLES[sectionType], paragraphs: buildCutTips() }
      }

      return { id: sectionType, title: DEFAULT_TITLES[sectionType], paragraphs: buildHarmonization(product) }
    })
    .filter((section) => section.paragraphs.length > 0)
}
