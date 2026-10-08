import { describe, expect, it } from 'vitest'
import { adjustmentBreakdown, adjustmentSentence, itemChange, orderAdjustment, signedBrl, signedPct, type AdjustmentItem } from './orderAdjustment'

describe('ajuste da separacao', () => {
  it('reducao: corte e peso a menos', () => {
    const a = orderAdjustment({ approvedTotal: 96.66, total: 87.92 })!
    expect(a.diff).toBe(-8.74)
    expect(signedBrl(a.diff)).toBe('−R$ 8,74')
    expect(signedPct(a.pct)).toBe('−9,0%')
  })

  it('aumento por peso', () => {
    const a = orderAdjustment({ approvedTotal: 68.7, total: 71.3 })!
    expect(signedBrl(a.diff)).toBe('+R$ 2,60')
    expect(signedPct(a.pct)).toBe('+3,8%')
  })

  it('sem valor aprovado guardado nao mostra nada', () => {
    expect(orderAdjustment({ approvedTotal: null, total: 50 })).toBeNull()
    expect(orderAdjustment({ total: 50 })).toBeNull()
  })
})

const item = (over: Partial<AdjustmentItem>): AdjustmentItem => ({ id: Math.random().toString(36), status: 'PICKED', quantity: 1, subtotal: 10, ...over })

describe('ajuste da separacao explicado', () => {
  it('pedido 102129: dois itens em falta e o resto igual', () => {
    const items = [
      item({ status: 'MISSING', subtotal: 9.95 }),
      item({ status: 'MISSING', subtotal: 1.59 }),
      item({ subtotal: 76.6, finalSubtotal: '76.60' }),
    ]
    const b = adjustmentBreakdown({ approvedTotal: 98.14, total: 86.6, items })!
    expect(b.diff).toBe(-11.54)
    expect(b.lines).toEqual([{ key: 'missing', label: 'Itens em falta', count: 2, amount: -11.54 }])
    expect(adjustmentSentence(b)).toBe('R$ 11,54 a menos que o aprovado pelo cliente (−11,8%)')
  })

  it('peso, quantidade, incluido, troca e frete separados', () => {
    const original = item({ id: 'o', status: 'SUBSTITUTED', subtotal: 14.99, substitutedByItemId: 's' })
    const items = [
      item({ subtotal: 20, finalSubtotal: 21.5, product: { isFractional: true } }),
      item({ subtotal: 10, finalSubtotal: 5 }),
      item({ subtotal: 7, finalSubtotal: 7, addedByPicker: true }),
      original,
      item({ id: 's', subtotal: 12.9, finalSubtotal: 12.9 }),
    ]
    const b = adjustmentBreakdown({ approvedTotal: 54.99, total: 60.4, items })!
    const by = Object.fromEntries(b.lines.map((l) => [l.key, [l.count, l.amount]]))
    expect(by).toEqual({ substitution: [1, -2.09], weight: [1, 1.5], quantity: [1, -5], added: [1, 7], other: [0, 4] })
  })

  it('item ainda nao separado nao entra na conta', () => {
    expect(itemChange(item({ status: 'PENDING' }), []).kind).toBe('pending')
  })
})
