import { describe, expect, it } from 'vitest'
import { personalize, renderCartTemplate } from './personalize'

// Espelha backend/src/common/personalize.spec.ts: a previa do admin tem que
// mostrar exatamente o que o servidor manda.
describe('personalize (previa do admin)', () => {
  it('nome e sem nome', () => {
    expect(personalize('{nome}, esqueceu algo no carrinho?', 'GIOVANA conceição')).toBe('Giovana, esqueceu algo no carrinho?')
    expect(personalize('{nome}, esqueceu algo no carrinho?', null)).toBe('Esqueceu algo no carrinho?')
    expect(personalize('Oi, {nome}! Chegou oferta.', '')).toBe('Oi! Chegou oferta.')
  })

  it('texto do lembrete de carrinho', () => {
    expect(renderCartTemplate('Você deixou {itens} ({total}).', { name: 'Ana', product: 'Batata Palha', itemCount: 3, subtotal: 42.8 })).toBe(
      'Você deixou Batata Palha e mais 2 itens (R$ 42,80).',
    )
  })
})
