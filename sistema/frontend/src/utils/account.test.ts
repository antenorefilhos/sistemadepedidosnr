import { describe, expect, it } from 'vitest'
import { formatPhone, formatWhen, itemQuantity, maskCpf, orderStep } from './account'

describe('conta do cliente', () => {
  it('etapa do pedido', () => {
    expect(orderStep('CONFIRMED')).toBe(0)
    expect(orderStep('PICKING')).toBe(1)
    expect(orderStep('READY_FOR_CHECKOUT')).toBe(1)
    expect(orderStep('OUT_FOR_DELIVERY')).toBe(2)
    expect(orderStep('READY_FOR_PICKUP')).toBe(2)
    expect(orderStep('DELIVERED')).toBe(3)
  })
  it('pesavel em kg, resto em unidades', () => {
    expect(itemQuantity({ quantity: 1.25, product: { isFractional: true } as never })).toBe('1,25 kg')
    expect(itemQuantity({ quantity: 3, product: { isFractional: false } as never })).toBe('3 un')
    expect(itemQuantity({ quantity: 0.22, product: { isFractional: true } as never })).toBe('220 g')
  })
  it('CPF pela metade e telefone formatado', () => {
    expect(maskCpf('12345678909')).toBe('123.***.***-09')
    expect(formatPhone('24999990000')).toBe('(24) 99999-0000')
  })
  it('hoje e ontem', () => {
    const now = new Date('2026-10-07T15:00:00')
    expect(formatWhen('2026-10-07T14:32:00', now)).toMatch(/^Hoje, 14:32/)
    expect(formatWhen('2026-10-06T09:10:00', now)).toMatch(/^Ontem, 09:10/)
  })
})
