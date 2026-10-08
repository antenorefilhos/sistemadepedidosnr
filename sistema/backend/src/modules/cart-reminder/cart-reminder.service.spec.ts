import { CartReminderService, renderCartTemplate } from './cart-reminder.service'

const SETTINGS = {
  cartEnabled: true,
  cartApproval: false,
  cartDelayMinutes: 120,
  cartTitle: '{nome}, esqueceu algo no carrinho?',
  cartBody: 'Você deixou {itens} no carrinho. Finalize seu pedido!',
  cartImage: true,
  cartMinTotal: 0,
  cartCooldownDays: 3,
}
const NOW = new Date('2026-10-02T15:00:00-03:00')
const PARADO = new Date('2026-10-02T14:00:00-03:00') // parou ha 1h

function build(over: { settings?: Partial<typeof SETTINGS>; snapshots?: any[]; existing?: any; pending?: any[]; bought?: number; recentCart?: number; customer?: any } = {}) {
  const prisma = {
    autoOfferSettings: { upsert: jest.fn().mockResolvedValue({ ...SETTINGS, ...over.settings }) },
    scheduledNotification: {
      findMany: jest.fn().mockResolvedValue(over.pending ?? []),
      findUnique: jest.fn().mockResolvedValue(over.existing ?? null),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn(),
    },
    cartSnapshot: {
      findMany: jest.fn().mockResolvedValue(over.snapshots ?? []),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    customer: { findUnique: jest.fn().mockResolvedValue(over.customer ?? { name: 'GIOVANA conceição', blocked: false }) },
    order: { count: jest.fn().mockResolvedValue(over.bought ?? 0) },
    notification: { count: jest.fn().mockResolvedValue(over.recentCart ?? 0) },
    product: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'p1', name: 'Batata Palha Extra Fina Yoki Pacote 100g', titleMask: null, ean: '789', price: 8.99, promotionalPrice: 5.99 },
        { id: 'p2', name: 'Leite Elege 1L', titleMask: null, ean: '790', price: 7.99, promotionalPrice: null },
      ]),
    },
  }
  return { service: new CartReminderService(prisma as never), prisma }
}
const snap = { customerId: 'c1', items: [{ productId: 'p1', quantity: 3 }, { productId: 'p2', quantity: 1 }], itemCount: 2, subtotal: 25.96, updatedAt: PARADO }

describe('renderCartTemplate', () => {
  it('{nome}, {produto}, {itens} e {total}', () => {
    const ctx = { name: 'GIOVANA conceição', product: 'Batata Palha', itemCount: 3, subtotal: 42.8 }
    expect(renderCartTemplate('{nome}, esqueceu algo?', ctx)).toBe('Giovana, esqueceu algo?')
    expect(renderCartTemplate('Você deixou {itens} ({total}).', ctx)).toBe('Você deixou Batata Palha e mais 2 itens (R$ 42,80).')
    expect(renderCartTemplate('Você deixou {itens}.', { ...ctx, itemCount: 2 })).toBe('Você deixou Batata Palha e mais 1 item.')
    expect(renderCartTemplate('Você deixou {itens}.', { ...ctx, itemCount: 1 })).toBe('Você deixou Batata Palha.')
  })

  it('sem nome cadastrado a frase sai inteira', () => {
    expect(renderCartTemplate('{nome}, esqueceu algo no carrinho?', { name: null, product: 'X', itemCount: 1, subtotal: 1 })).toBe('Esqueceu algo no carrinho?')
  })
})

describe('CartReminderService.saveSnapshot', () => {
  it('reenviar o mesmo carrinho nao reinicia o relogio do lembrete', async () => {
    const { service, prisma } = build()
    prisma.cartSnapshot.findUnique.mockResolvedValue({ items: [{ productId: 'p1', quantity: 3 }, { productId: 'p2', quantity: 1 }] })

    await service.saveSnapshot('c1', [{ productId: 'p2', quantity: 1 }, { productId: 'p1', quantity: 3 }])

    expect(prisma.cartSnapshot.upsert).not.toHaveBeenCalled()
  })

  it('preco vem do banco (promocao vale) e produto inexistente e ignorado', async () => {
    const { service, prisma } = build()
    prisma.cartSnapshot.findUnique.mockResolvedValue(null)

    await service.saveSnapshot('c1', [{ productId: 'p1', quantity: 2 }, { productId: 'nao-existe', quantity: 9 }, { productId: 'p2', quantity: 0 }])

    const data = prisma.cartSnapshot.upsert.mock.calls[0][0].create
    expect(data.items).toEqual([{ productId: 'p1', quantity: 2 }])
    expect(data.subtotal).toBe(11.98)
  })

  it('carrinho vazio apaga', async () => {
    const { service, prisma } = build()
    await service.saveSnapshot('c1', [])
    expect(prisma.cartSnapshot.deleteMany).toHaveBeenCalledWith({ where: { customerId: 'c1' } })
  })
})

describe('CartReminderService.plan (fila de envios)', () => {
  beforeAll(() => jest.useFakeTimers().setSystemTime(NOW))
  afterAll(() => jest.useRealTimers())

  it('carrinho parado vira lembrete na fila, com o nome, o item mais caro e a hora certa', async () => {
    const { service, prisma } = build({ snapshots: [snap] })

    const r = await service.plan(NOW)

    expect(r.planned).toBe(1)
    const data = prisma.scheduledNotification.create.mock.calls[0][0].data
    expect(data).toEqual(
      expect.objectContaining({
        origin: 'CARRINHO',
        status: 'SCHEDULED',
        sourceKey: `carrinho:c1:${PARADO.getTime()}`,
        title: 'Giovana, esqueceu algo no carrinho?',
        body: 'Você deixou Batata Palha Extra Fina Yoki Pacote… e mais 1 item no carrinho. Finalize seu pedido!',
        url: '/carrinho',
        customerId: 'c1',
        imageUrl: '/uploads/products/789.webp',
        respectHours: true,
      }),
    )
    expect(data.sendAt.toISOString()).toBe(new Date(PARADO.getTime() + 120 * 60_000).toISOString())
  })

  it('quem comprou depois de mexer no carrinho nao e lembrado (e o carrinho guardado sai)', async () => {
    const { service, prisma } = build({ snapshots: [snap], bought: 1 })
    expect((await service.plan(NOW)).planned).toBe(0)
    expect(prisma.cartSnapshot.deleteMany).toHaveBeenCalledWith({ where: { customerId: 'c1' } })
  })

  it('lembrado ha pouco (intervalo entre lembretes): nao lembra de novo', async () => {
    const { service } = build({ snapshots: [snap], recentCart: 1 })
    expect((await service.plan(NOW)).planned).toBe(0)
  })

  it('abaixo do valor minimo: nao lembra', async () => {
    const { service } = build({ snapshots: [snap], settings: { cartMinTotal: 50 } })
    expect((await service.plan(NOW)).planned).toBe(0)
  })

  it('cliente mexeu no carrinho: o lembrete da versao antiga sai da fila', async () => {
    const { service, prisma } = build({ snapshots: [], pending: [{ id: 'q-old', sourceKey: 'carrinho:c1:1', editedAt: null }] })
    const r = await service.plan(NOW)
    expect(prisma.scheduledNotification.delete).toHaveBeenCalledWith({ where: { id: 'q-old' } })
    expect(r.removed).toBe(1)
  })

  it('com aprovacao exigida, entra aguardando aprovacao', async () => {
    const { service, prisma } = build({ snapshots: [snap], settings: { cartApproval: true } })
    await service.plan(NOW)
    expect(prisma.scheduledNotification.create.mock.calls[0][0].data.status).toBe('PENDING_APPROVAL')
  })

  it('desligado: cancela o que estava na fila', async () => {
    const { service, prisma } = build({ settings: { cartEnabled: false } })
    await service.plan(NOW)
    expect(prisma.scheduledNotification.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED', note: 'Lembrete de carrinho desligado.' }) }))
  })
})
