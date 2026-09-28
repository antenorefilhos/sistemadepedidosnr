import { describe, expect, it } from 'vitest'
import type { Product } from '../types'
import { getProductDetailSections, getWineFacts } from './productDetailSchema'
import { erpIdFromSlug, productPath } from './productUrl'

const p = (over: Partial<Product>): Product => ({ id: 'cabc', ean: '1', name: '', price: 10, active: true, ...over })

describe('URL limpa do produto', () => {
  it('monta /p/<slug>-<erpProductId> e volta o id a partir do slug', () => {
    const path = productPath(p({ name: 'Vinho Tinto Chileno Intacto Syrah Mosqueteros Garrafa 750ml', erpProductId: 22030 }))
    expect(path).toBe('/p/vinho-tinto-chileno-intacto-syrah-mosqueteros-garrafa-750ml-22030')
    expect(erpIdFromSlug(path.slice(3))).toBe('22030')
  })
  it('sem erpProductId cai no link antigo', () => {
    expect(productPath(p({ name: 'X' }))).toBe('/produto/cabc')
  })
})

describe('ficha do vinho', () => {
  it('extrai tipo, pais, uva, classificacao, volume e temperatura do nome', () => {
    const facts = getWineFacts(p({ name: 'Vinho Tinto Chileno Gran Reserva Cabernet Sauvignon Perez Cruz Garrafa 750ml' }))
    expect(facts).toEqual([
      { label: 'Tipo', value: 'Tinto' },
      { label: 'País', value: 'Chile' },
      { label: 'Uva', value: 'Cabernet Sauvignon' },
      { label: 'Classificação', value: 'Gran Reserva' },
      { label: 'Volume', value: '750 ml' },
      { label: 'Harmoniza com', value: 'Carnes vermelhas grelhadas, cordeiro e queijos curados' },
      { label: 'Servir entre', value: '16 °C a 18 °C' },
    ])
  })
  it('Touriga Nacional nao vira vinho brasileiro', () => {
    const pais = getWineFacts(p({ name: 'Vinho Tinto Portugues Touriga Nacional Vinha do Rosario Garrafa 750ml' })).find((f) => f.label === 'País')
    expect(pais?.value).toBe('Portugal')
  })
  it('nao mostra estoque nem EAN em nenhum produto', () => {
    const all = getProductDetailSections(p({ name: 'Arroz Branco 5kg', stock: 30, ean: '789', category: 'MERCEARIA_DESPENSA' }))
    expect(JSON.stringify(all)).not.toMatch(/Estoque|EAN/)
  })
})

describe('ficha de carne e harmonizacao', () => {
  it('picanha: preparo e quanto comprar', () => {
    const [meat] = getProductDetailSections(p({ name: 'Picanha Bovina Bassi kg', category: 'ACOUGUE_CHURRASCO', isFractional: true, fractionStep: 0.5, unit: 'kg' }))
    expect(meat.title).toBe('Sobre este corte')
    expect(meat.facts[0]).toEqual({ label: 'Indicado para', value: 'Churrasco e grelha (em peça ou em bifes grossos)' })
    expect(meat.facts.map((f) => f.label)).toContain('Quanto comprar')
  })
  it('linguica da "Casa" nao vira asa de frango', () => {
    const [meat] = getProductDetailSections(p({ name: 'Linguiça Toscana da Casa kg', category: 'ACOUGUE_CHURRASCO' }))
    expect(meat.facts[0].value).toBe('Churrasco, frigideira e forno')
  })
  it('harmonizacao pela uva; suave vai para sobremesa', () => {
    const cab = getWineFacts(p({ name: 'Vinho Tinto Chileno Reserva Cabernet Sauvignon Viu Manent Garrafa 750ml' }))
    expect(cab.find((f) => f.label === 'Harmoniza com')?.value).toMatch(/Carnes vermelhas grelhadas/)
    const suave = getWineFacts(p({ name: 'Vinho Tinto Nacional Suave Galiotto Garrafa' }))
    expect(suave.find((f) => f.label === 'Harmoniza com')?.value).toMatch(/Sobremesas/)
  })
})
