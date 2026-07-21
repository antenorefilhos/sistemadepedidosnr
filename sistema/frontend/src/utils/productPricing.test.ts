import { describe, it, expect } from 'vitest'
import type { Product } from '../types'
import {
  normalizeFractionUnit,
  getFractionDisplayUnit,
  formatPortionFromStep,
  getProductStep,
  getProductUnitPrice,
  getProductDisplayPrice,
  getProductLineTotal,
  formatProductQuantity,
  getProductPricePresentation,
  hasConfiguredFractionStep,
} from './productPricing'

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-1',
  ean: '789',
  name: 'Produto Teste',
  price: 10,
  active: true,
  isFractional: false,
  ...overrides,
})

describe('normalizeFractionUnit', () => {
  it('retorna un para vazio', () => {
    expect(normalizeFractionUnit('')).toBe('un')
    expect(normalizeFractionUnit(undefined)).toBe('un')
  })

  it('normaliza variações de quilo para kg', () => {
    expect(normalizeFractionUnit('quilo')).toBe('kg')
    expect(normalizeFractionUnit('kilo')).toBe('kg')
    expect(normalizeFractionUnit('kgs')).toBe('kg')
    expect(normalizeFractionUnit('KG')).toBe('kg')
  })

  it('normaliza variações de grama para g', () => {
    expect(normalizeFractionUnit('grama')).toBe('g')
    expect(normalizeFractionUnit('gramas')).toBe('g')
  })

  it('normaliza variações de unidade para un', () => {
    expect(normalizeFractionUnit('unidade')).toBe('un')
    expect(normalizeFractionUnit('und')).toBe('un')
  })

  it('normaliza variações de litro para l', () => {
    expect(normalizeFractionUnit('litro')).toBe('l')
    expect(normalizeFractionUnit('litros')).toBe('l')
    expect(normalizeFractionUnit('lt')).toBe('l')
  })

  it('retorna string numérica como un (código ERP)', () => {
    expect(normalizeFractionUnit('1')).toBe('un')
  })

  it('retorna o raw para unidades desconhecidas', () => {
    expect(normalizeFractionUnit('ml')).toBe('ml')
  })
})

describe('getFractionDisplayUnit', () => {
  it('retorna kg como fallback para produtos fracionados sem unit reconhecida', () => {
    const product = makeProduct({ isFractional: true, unit: '' })
    expect(getFractionDisplayUnit(product)).toBe('kg')
  })

  it('retorna unidade normalizada para produto fracionado com unit', () => {
    const product = makeProduct({ isFractional: true, unit: 'litro' })
    expect(getFractionDisplayUnit(product)).toBe('l')
  })

  it('retorna un para produto não fracionado', () => {
    const product = makeProduct({ isFractional: false, unit: '' })
    expect(getFractionDisplayUnit(product)).toBe('un')
  })
})

describe('formatPortionFromStep', () => {
  it('formata gramas quando step < 1 kg', () => {
    expect(formatPortionFromStep(0.1, 'kg')).toBe('100 g')
    expect(formatPortionFromStep(0.5, 'kg')).toBe('500 g')
  })

  it('formata quilos inteiros', () => {
    expect(formatPortionFromStep(1, 'kg')).toBe('1 kg')
    expect(formatPortionFromStep(2, 'kg')).toBe('2 kg')
  })

  it('formata quilos fracionados com vírgula', () => {
    expect(formatPortionFromStep(1.5, 'kg')).toBe('1,5 kg')
  })

  it('converte gramas para kg quando >= 1000', () => {
    expect(formatPortionFromStep(1000, 'g')).toBe('1 kg')
  })

  it('formata ml abaixo de 1000', () => {
    expect(formatPortionFromStep(500, 'ml')).toBe('500 ml')
  })

  it('converte ml para litros quando >= 1000', () => {
    expect(formatPortionFromStep(1000, 'ml')).toBe('1 l')
  })

  it('formata litros inteiros', () => {
    expect(formatPortionFromStep(1, 'l')).toBe('1 l')
  })

  it('formata litros fracionados com vírgula', () => {
    expect(formatPortionFromStep(1.5, 'l')).toBe('1,5 l')
  })

  it('formata unidade genérica inteira', () => {
    expect(formatPortionFromStep(3, 'un')).toBe('3 un')
  })

  it('formata unidade genérica fracionada com vírgula', () => {
    expect(formatPortionFromStep(0.5, 'un')).toBe('0,5 un')
  })
})

describe('getProductStep', () => {
  it('retorna 1 para produto não fracionado', () => {
    const p = makeProduct({ isFractional: false })
    expect(getProductStep(p)).toBe(1)
  })

  it('retorna fractionStep configurado para produto fracionado', () => {
    const p = makeProduct({ isFractional: true, fractionStep: 0.2 })
    expect(getProductStep(p)).toBe(0.2)
  })

  it('nao inventa 100g para kg sem fractionStep', () => {
    const p = makeProduct({ isFractional: true, unit: 'kg', fractionStep: undefined })
    expect(getProductStep(p)).toBe(1)
  })

  it('nao inventa 100g para quilo sem fractionStep', () => {
    const p = makeProduct({ isFractional: true, unit: 'quilo', fractionStep: undefined })
    expect(getProductStep(p)).toBe(1)
  })

  it('nao inventa 100g para fracionado com unit un', () => {
    const p = makeProduct({ isFractional: true, unit: 'un', fractionStep: undefined })
    expect(getProductStep(p)).toBe(1)
  })

  it('ignora fractionStep zero sem criar porcao default', () => {
    const p = makeProduct({ isFractional: true, unit: 'kg', fractionStep: 0 })
    expect(getProductStep(p)).toBe(1)
  })
})

describe('hasConfiguredFractionStep', () => {
  it('retorna true para produto nao fracionado', () => {
    expect(hasConfiguredFractionStep(makeProduct({ isFractional: false }))).toBe(true)
  })

  it('retorna true para fracionado com fractionStep positivo', () => {
    expect(hasConfiguredFractionStep(makeProduct({ isFractional: true, fractionStep: 0.25 }))).toBe(true)
  })

  it('retorna false para fracionado sem fractionStep positivo', () => {
    expect(hasConfiguredFractionStep(makeProduct({ isFractional: true, fractionStep: undefined }))).toBe(false)
    expect(hasConfiguredFractionStep(makeProduct({ isFractional: true, fractionStep: 0 }))).toBe(false)
  })
})

describe('getProductUnitPrice', () => {
  it('retorna preço normal sem promoção', () => {
    const p = makeProduct({ price: 10 })
    expect(getProductUnitPrice(p)).toBe(10)
  })

  it('retorna preço promocional quando menor que o normal', () => {
    const p = makeProduct({ price: 10, promotionalPrice: 7.5 })
    expect(getProductUnitPrice(p)).toBe(7.5)
  })

  it('retorna preço normal quando promocional é zero', () => {
    const p = makeProduct({ price: 10, promotionalPrice: 0 })
    expect(getProductUnitPrice(p)).toBe(10)
  })

  it('retorna preço normal quando promocional é maior que normal', () => {
    const p = makeProduct({ price: 10, promotionalPrice: 15 })
    expect(getProductUnitPrice(p)).toBe(10)
  })

  it('retorna preço normal quando promotionalPrice é undefined', () => {
    const p = makeProduct({ price: 10, promotionalPrice: undefined })
    expect(getProductUnitPrice(p)).toBe(10)
  })
})

describe('getProductDisplayPrice', () => {
  it('produto normal: preço × 1', () => {
    const p = makeProduct({ price: 10, isFractional: false })
    expect(getProductDisplayPrice(p)).toBe(10)
  })

  it('produto fracionado 0.1kg: preço × 0.1', () => {
    const p = makeProduct({ price: 20, isFractional: true, unit: 'kg', fractionStep: 0.1 })
    expect(getProductDisplayPrice(p)).toBeCloseTo(2)
  })

  it('produto fracionado com promoção: usa preço promocional × step', () => {
    const p = makeProduct({ price: 20, promotionalPrice: 15, isFractional: true, unit: 'kg', fractionStep: 0.5 })
    expect(getProductDisplayPrice(p)).toBeCloseTo(7.5)
  })
})

describe('getProductLineTotal', () => {
  it('calcula total corretamente para 3 itens', () => {
    const p = makeProduct({ price: 10, isFractional: false })
    expect(getProductLineTotal(p, 3)).toBe(30)
  })

  it('calcula total para produto fracionado', () => {
    const p = makeProduct({ price: 20, isFractional: true, unit: 'kg', fractionStep: 0.5 })
    expect(getProductLineTotal(p, 2)).toBeCloseTo(20)
  })

  it('total zero para quantidade zero', () => {
    const p = makeProduct({ price: 10 })
    expect(getProductLineTotal(p, 0)).toBe(0)
  })
})

describe('formatProductQuantity', () => {
  it('retorna número inteiro para produto não fracionado', () => {
    const p = makeProduct({ isFractional: false })
    expect(formatProductQuantity(p, 3)).toBe('3')
  })

  it('formata em gramas para produto kg fracionado com step 0.1', () => {
    const p = makeProduct({ isFractional: true, unit: 'kg', fractionStep: 0.1 })
    expect(formatProductQuantity(p, 1)).toBe('100 g')
  })

  it('formata em kg para quantidade maior', () => {
    const p = makeProduct({ isFractional: true, unit: 'kg', fractionStep: 0.5 })
    expect(formatProductQuantity(p, 2)).toBe('1 kg')
  })
})

describe('getProductPricePresentation', () => {
  it('retorna suffix /un para produto normal', () => {
    const p = makeProduct({ price: 10, isFractional: false })
    const pres = getProductPricePresentation(p)
    expect(pres.suffix).toBe('/un')
  })

  it('retorna suffix /Xg para produto kg fracionado', () => {
    const p = makeProduct({ price: 20, isFractional: true, unit: 'kg', fractionStep: 0.1 })
    const pres = getProductPricePresentation(p)
    expect(pres.suffix).toContain('100 g')
  })

  it('retorna referenceText com preço/kg para fracionado', () => {
    const p = makeProduct({ price: 20, isFractional: true, unit: 'kg', fractionStep: 0.1 })
    const pres = getProductPricePresentation(p)
    expect(pres.referenceText).toContain('/kg')
  })

  it('retorna referenceText vazio para produto normal', () => {
    const p = makeProduct({ price: 10, isFractional: false })
    const pres = getProductPricePresentation(p)
    expect(pres.referenceText).toBe('')
  })

  it('usa preço promocional no unitPrice', () => {
    const p = makeProduct({ price: 20, promotionalPrice: 15, isFractional: false })
    const pres = getProductPricePresentation(p)
    expect(pres.unitPrice).toBe(15)
  })

  it('marca fracionado sem fractionStep como pendente sem porcao 100g', () => {
    const p = makeProduct({ price: 20, isFractional: true, unit: 'kg', fractionStep: undefined })
    const pres = getProductPricePresentation(p)
    expect(pres.suffix).toBe('/kg')
    expect(pres.referenceText).toBe('Fracionamento pendente')
    expect(pres.portionLabel).toBe('')
    expect(pres.fullLabel).not.toContain('100 g')
  })
})
