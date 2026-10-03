import { describe, expect, it } from 'vitest'
import { orderAdjustment, signedBrl, signedPct } from './orderAdjustment'

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
