import { OfferPushService } from './offer-push.service'

// Algoritmo dos avisos de oferta (29/09/2026): cada cliente recebe a oferta de
// maior nota PARA ELE, respeitando limites.
describe('OfferPushService.plan', () => {
  const now = new Date('2026-09-30T14:00:00Z')
  const product = (id: string, category: string, price: number, promo: number) => ({
    id, ean: id, name: `Produto ${id}`, titleMask: null, category, price, promotionalPrice: promo,
    promotionalPriceValidUntil: null, active: true, syncOption: 'SEMPRE', stock: 10, isFractional: false, unit: 'un',
  })

  const build = (overrides: Record<string, unknown> = {}) => {
    const service = Object.create(OfferPushService.prototype) as any
    const queries: Array<Array<Record<string, unknown>>> = [
      [], // vendas
      [], // visitas
      [{ customerId: 'c1', productId: 'b', category: 'MERCEARIA_DESPENSA' }], // c1 comprou b
      [], // visualizacoes
    ]
    service.prisma = {
      productCategoryMapping: { findMany: jest.fn().mockResolvedValue([{ ean: 'a' }, { ean: 'b' }, { ean: 'c' }]) },
      product: {
        findMany: jest.fn().mockResolvedValue([
          product('a', 'ACOUGUE_CHURRASCO', 100, 70), // 30%
          product('b', 'MERCEARIA_DESPENSA', 10, 8), // 20%
          product('c', 'MERCEARIA_DESPENSA', 10, 9.5), // 5%: abaixo do minimo
        ]),
      },
      pushSubscription: { findMany: jest.fn().mockResolvedValue([{ customerId: 'c1' }, { customerId: 'c2' }, { customerId: 'c3' }]) },
      customer: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Ana' }, { id: 'c2', name: 'Bia' }, { id: 'c3', name: 'Caio' }]) },
      notification: {
        findMany: jest.fn().mockResolvedValue([{ customerId: 'c3', productId: 'a', createdAt: new Date(now.getTime() - 3600_000) }]), // c3 recebeu ha 1 h
      },
      $queryRaw: jest.fn().mockImplementation(() => Promise.resolve(queries.shift() || [])),
      category: { findMany: jest.fn().mockResolvedValue([]) },
      ...overrides,
    }
    service.getSettings = jest.fn().mockResolvedValue({ minDiscount: 15, maxPerWeek: 3 })
    service.learnWeights = jest.fn().mockResolvedValue({ weights: {} })
    return service
  }

  it('personaliza, respeita desconto minimo e o limite diario', async () => {
    jest.spyOn(require('fs'), 'readdirSync').mockReturnValue(['a.webp', 'b.webp', 'c.webp'] as any)
    const { picks, candidates } = await build().plan(now)
    expect(candidates).toBe(2) // "c" (5%) fica de fora
    const by = Object.fromEntries(picks.map((p: any) => [p.customerId, p]))
    expect(by.c1.productId).toBe('b') // comprou: interesse vence o desconto maior
    expect(by.c1.reason).toBe('já comprou este produto')
    expect(by.c2.productId).toBe('a') // sem historico: melhor oferta do dia
    expect(by.c3).toBeUndefined() // ja recebeu aviso ha menos de 20 h
    expect(by.c2.title).toContain('30% OFF')
  })
})
