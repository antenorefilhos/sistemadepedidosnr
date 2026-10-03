import { describe, expect, it } from 'vitest'
import { getProductCardViewModel } from './productCard'

const base = { id: 'p', ean: '1', name: 'Vinho', price: 100, active: true, syncOption: 'SEMPRE' as const, stock: 10 }

// 03/10/2026: a etiqueta escolhida no admin nao aparecia no card (so "TOP" virava selo).
describe('etiqueta do admin no card', () => {
  it('"Mais Vendido" do admin vira o selo de mais vendido', () => {
    const vm = getProductCardViewModel({ ...base, badges: 'Mais Vendido' })
    expect(vm.badgeText).toBe('🔥 Mais vendido')
    expect(vm.badgeVariant).toBe('top')
  })

  it('as outras etiquetas aparecem com o texto escolhido', () => {
    for (const label of ['Importado', 'Premium', 'Luxo', 'Exclusivo', 'Especialidade']) {
      const vm = getProductCardViewModel({ ...base, badges: label })
      expect(vm.badgeText).toBe(label)
      expect(vm.badgeVariant).toBe('label')
    }
  })

  it('promocao continua na frente da etiqueta', () => {
    const vm = getProductCardViewModel({ ...base, badges: 'Importado', promotionalPrice: 80 })
    expect(vm.badgeVariant).toBe('promo')
  })
})
