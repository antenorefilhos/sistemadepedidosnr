import { describe, expect, it } from 'vitest'
import { pendingSuggestions, replyDeadline, suggestionQuantityLabel, totalsWithSuggestions } from './substitution'
import type { SubstitutionSuggestion } from '../types'

const s = (o: Partial<SubstitutionSuggestion>): SubstitutionSuggestion => ({
  id: 's', orderItemId: 'i', productId: 'p', quantity: 1, unitPrice: 10, status: 'PENDING', sentAt: '2026-10-08T12:00:00.000Z',
  decidedAt: null, decidedBy: null, product: { id: 'p', name: 'P', ean: null, unit: 'UN', isFractional: false }, ...o,
})

describe('troca sugerida na conta do cliente', () => {
  it('so o que foi enviado e espera resposta', () => {
    const list = [s({ id: 'a' }), s({ id: 'b', sentAt: null }), s({ id: 'c', status: 'ACCEPTED' })]
    expect(pendingSuggestions({ substitutionSuggestions: list }).map((x) => x.id)).toEqual(['a'])
    expect(pendingSuggestions({})).toEqual([])
  })

  it('prazo de 15 min depois do ultimo envio', () => {
    const d = replyDeadline([s({ sentAt: '2026-10-08T12:00:00.000Z' }), s({ sentAt: '2026-10-08T12:05:00.000Z' })])
    expect(d?.toISOString()).toBe('2026-10-08T12:20:00.000Z')
    expect(replyDeadline([])).toBeNull()
  })

  it('total com e sem as trocas', () => {
    expect(totalsWithSuggestions({ total: 73.52 }, [s({ unitPrice: 12.9 }), s({ unitPrice: 9.99 })])).toEqual({ without: 73.52, with: 96.41 })
  })

  it('quantidade: gramas abaixo de 1 kg', () => {
    expect(suggestionQuantityLabel(s({ quantity: 0.268, product: { id: 'p', name: 'P', ean: null, unit: 'KG', isFractional: true } }))).toBe('268 g')
    expect(suggestionQuantityLabel(s({ quantity: 1.5, product: { id: 'p', name: 'P', ean: null, unit: 'KG', isFractional: true } }))).toBe('1,5 kg')
    expect(suggestionQuantityLabel(s({ quantity: 2 }))).toBe('2 un')
    expect(suggestionQuantityLabel(s({ quantity: 1 }))).toBe('')
  })
})
