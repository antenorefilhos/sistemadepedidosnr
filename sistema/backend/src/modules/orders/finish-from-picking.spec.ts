import { finishStatusAfter } from './orders.service'

// 03/10/2026: o app de separacao finaliza o pedido enquanto o entregador nao usa o app dele.
describe('ultimo passo pelo app de separacao', () => {
  it('entrega vira entregue', () => {
    expect(finishStatusAfter('READY_FOR_DELIVERY')).toBe('DELIVERED')
    expect(finishStatusAfter('OUT_FOR_DELIVERY')).toBe('DELIVERED')
  })

  it('retirada ou entregue vira concluido', () => {
    expect(finishStatusAfter('READY_FOR_PICKUP')).toBe('COMPLETED')
    expect(finishStatusAfter('DELIVERED')).toBe('COMPLETED')
  })

  it('antes do caixa, ou ja encerrado, nao finaliza', () => {
    for (const s of ['PENDING', 'CONFIRMED', 'PICKING', 'READY_FOR_CHECKOUT', 'COMPLETED', 'CANCELLED', 'REFUNDED']) {
      expect(finishStatusAfter(s)).toBeNull()
    }
  })
})
