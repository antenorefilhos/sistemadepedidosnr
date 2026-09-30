import { PricingService } from './pricing.service'

// Cupom "so na primeira compra" (29/09/2026).
describe('PricingService cupom de primeira compra', () => {
  const coupon = (condition: Record<string, unknown>) => ({ id: 'c1', maxUses: null, maxUsesPerCustomer: null, promotion: { rules: [{ condition }] } })
  const build = (previousOrders: number) => {
    const service = Object.create(PricingService.prototype) as any
    service.prisma = { order: { count: jest.fn().mockResolvedValue(previousOrders) }, promotionUsage: { count: jest.fn().mockResolvedValue(0) } }
    return service
  }

  it('recusa quem ja tem pedido valido', async () => {
    await expect(build(1).assertCouponUsageLimit(coupon({ firstOrderOnly: true }), 'cli')).rejects.toThrow('primeira compra')
  })
  it('aceita quem nunca comprou', async () => {
    await expect(build(0).assertCouponUsageLimit(coupon({ firstOrderOnly: true }), 'cli')).resolves.toBeUndefined()
  })
  it('cupom comum nao consulta pedidos', async () => {
    const s = build(5)
    await expect(s.assertCouponUsageLimit(coupon({}), 'cli')).resolves.toBeUndefined()
    expect(s.prisma.order.count).not.toHaveBeenCalled()
  })
})
