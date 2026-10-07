import { describe, expect, it } from 'vitest'
import type { Product } from '../types'
import { formatProductTitle } from './format'
import { getUnitReference } from './productPricing'
import { getProductCardViewModel } from './productCard'
import { fractionNote, getProductDetailSections } from './productDetailSchema'

const p = (over: Partial<Product>): Product => ({ id: 'p', ean: '1', name: 'X', price: 10, active: true, ...over })

// Revisao da pagina do produto (07/10/2026).
describe('titulo do produto', () => {
  it('nome curado do cadastro fica como esta (sigla e medida)', () => {
    expect(formatProductTitle('Leite Longa Vida UHT Integral Elege Caixinha 1L')).toBe('Leite Longa Vida UHT Integral Elege Caixinha 1L')
    expect(formatProductTitle('Pão Francês Unidade AeF')).toBe('Pão Francês Unidade AeF')
    expect(formatProductTitle('Vinho Tinto Italiano Chianti DOCG Torrequercie 750ml')).toBe('Vinho Tinto Italiano Chianti DOCG Torrequercie 750ml')
  })

  it('nome gritado do cadastro antigo ainda vira titulo', () => {
    expect(formatProductTitle('BISCOITO WAFER MEGA PANCO PACOTE 112g CHOCOLATE')).toBe('Biscoito Wafer Mega Panco Pacote 112g Chocolate')
  })
})

describe('produto fora do site', () => {
  it('oculto no admin (active=false) nao pode ser comprado, mesmo SEMPRE', () => {
    expect(getProductCardViewModel(p({ active: false, syncOption: 'SEMPRE', stock: -293743 })).outOfStock).toBe(true)
  })
  it('ativo e SEMPRE continua a venda', () => {
    expect(getProductCardViewModel(p({ syncOption: 'SEMPRE', stock: -5 })).outOfStock).toBe(false)
  })
})

describe('nota de fracionamento do ERP', () => {
  it('vira linguagem de cliente', () => {
    expect(fractionNote('Fracionamento: Peso aproximado / 1und.')).toBe('cerca de 1 unidade')
    expect(fractionNote('Fracionamento: Peso aproximado / 4und.')).toBe('cerca de 4 unidades')
    expect(fractionNote('Fracionamento: Peso aproximado / 1 gomo.')).toBe('cerca de 1 gomo')
    expect(fractionNote('Fracionamento: Peso aproximado / Pedaço, Bifes ou Picadinho')).toBe('pedaço, bifes ou picadinho')
    expect(fractionNote('Fracionamento: 6 Unidades em pacote.')).toBe('6 unidades em pacote')
  })
  it('aviso generico e "peso aproximado" sozinho nao aparecem', () => {
    expect(fractionNote('Fracionamento: Preços de produtos pesáveis podem sofrer variação')).toBe('')
    expect(fractionNote('Fracionamento: Peso aproximado')).toBe('')
    expect(fractionNote(null)).toBe('')
  })
  it('entra na porcao minima da ficha', () => {
    const sections = getProductDetailSections(
      p({ name: 'Limão Tahiti kg', isFractional: true, fractionStep: 0.15, unit: 'KG', category: 'HORTIFRUTI_ORGANICOS', alternativeDescription: 'Fracionamento: Peso aproximado / 1 limão.' }),
    )
    const portion = sections.flatMap((s) => s.facts).find((f) => f.label === 'Cada porção')
    expect(portion?.value).toMatch(/\(cerca de 1 limão\)$/)
    expect(JSON.stringify(sections)).not.toMatch(/Venda/)
  })
})

describe('preco por unidade de medida', () => {
  it('embalagem em g e ml vira R$/kg e R$/L', () => {
    expect(getUnitReference(p({ name: 'Requeijão Cremoso Tradicional Catupiry Pouch 250g', price: 22.9 }))).toBe('R$\u00a091,60/kg')
    expect(getUnitReference(p({ name: 'Cerveja Pilsen Brahma Lata 350ml', price: 4.99 }))).toBe('R$\u00a014,26/L')
    expect(getUnitReference(p({ name: 'Refrigerante Coca Cola 2L', price: 12, promotionalPrice: 10 }))).toBe('R$\u00a05,00/L')
  })
  it('embalagem de 1 kg/1 L, multipla ou sem medida nao mostra', () => {
    expect(getUnitReference(p({ name: 'Leite Longa Vida UHT Integral Elege Caixinha 1L', price: 7.99 }))).toBe('')
    expect(getUnitReference(p({ name: 'Sobremesa Danette Pack 4x90g', price: 12 }))).toBe('')
    expect(getUnitReference(p({ name: 'Ovo Branco Cart 12 Unidades', price: 10 }))).toBe('')
    expect(getUnitReference(p({ name: 'Vassoura Pelo', price: 10 }))).toBe('')
  })
})
