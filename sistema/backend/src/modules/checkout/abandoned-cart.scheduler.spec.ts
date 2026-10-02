import { AbandonedCartScheduler } from './abandoned-cart.scheduler'

describe('AbandonedCartScheduler', () => {
  function makeScheduler(carts: any[]) {
    const prisma = {
      cart: {
        findMany: jest.fn().mockResolvedValue(carts),
        update: jest.fn().mockResolvedValue({}),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Banana' }),
      },
      autoOfferSettings: { findUnique: jest.fn().mockResolvedValue({ cartEnabled: true }) },
      brandConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    }
    const notificationsService = {
      create: jest.fn().mockResolvedValue({}),
    }
    return {
      scheduler: new AbandonedCartScheduler(prisma as any, notificationsService as any),
      prisma,
      notificationsService,
    }
  }

  it('notifica carrinho elegivel (ACTIVE, sem notificacao, velho) e marca abandonedNotifiedAt', async () => {
    const { scheduler, prisma, notificationsService } = makeScheduler([
      { id: 'cart-1', customerId: 'customer-1', items: [{ productId: 'prod-1' }] },
    ])

    await scheduler.handleCycle()

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'customer-1', type: 'CAMPAIGN' }),
    )
    expect(prisma.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart-1' },
      data: { abandonedNotifiedAt: expect.any(Date) },
    })
  })

  it('nao notifica carrinho ja notificado (filtrado na query, nao retorna do findMany)', async () => {
    const { scheduler, prisma, notificationsService } = makeScheduler([])

    await scheduler.handleCycle()

    expect(prisma.cart.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ abandonedNotifiedAt: null }),
      }),
    )
    expect(notificationsService.create).not.toHaveBeenCalled()
    expect(prisma.cart.update).not.toHaveBeenCalled()
  })

  it('ignora carrinho sem customerId', async () => {
    const { scheduler, notificationsService, prisma } = makeScheduler([
      { id: 'cart-2', customerId: null, items: [{ productId: 'prod-1' }] },
    ])

    await scheduler.handleCycle()

    expect(notificationsService.create).not.toHaveBeenCalled()
    expect(prisma.cart.update).not.toHaveBeenCalled()
  })

  it('desligado na fila de envios: nao lembra ninguem', async () => {
    const { scheduler, prisma, notificationsService } = makeScheduler([{ id: 'cart-1', customerId: 'customer-1', items: [{ productId: 'prod-1' }] }])
    prisma.autoOfferSettings.findUnique.mockResolvedValue({ cartEnabled: false })

    await scheduler.handleCycle()

    expect(prisma.cart.findMany).not.toHaveBeenCalled()
    expect(notificationsService.create).not.toHaveBeenCalled()
  })

  it('loja fechada: espera abrir (nao manda lembrete de madrugada)', async () => {
    const { scheduler, prisma, notificationsService } = makeScheduler([{ id: 'cart-1', customerId: 'customer-1', items: [{ productId: 'prod-1' }] }])
    prisma.brandConfig.findUnique.mockResolvedValue({ businessHours: '{}', specialDates: JSON.stringify([{ date: '2020-01-05', windows: [{ start: '00:00', end: '23:59' }] }]) })

    await scheduler.handleCycle()

    expect(notificationsService.create).not.toHaveBeenCalled()
  })
})
