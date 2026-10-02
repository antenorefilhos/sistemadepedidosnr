// JON-140: assertPublicHttpsEndpoint faz DNS real -- 'push.example' e um
// dominio reservado (RFC 2606) que nunca resolve. Mocka aqui pra testar
// savePushSubscription sem depender de rede/DNS real; a validacao em si
// tem spec propria (assert-public-endpoint.spec.ts).
jest.mock('../../common/security/assert-public-endpoint', () => ({
  assertPublicHttpsEndpoint: jest.fn().mockResolvedValue(undefined),
}))

import { NotificationsService } from './notifications.service'

describe('NotificationsService', () => {
  function makeService() {
    const prisma = {
      notification: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'notif-1', read: false, ...data })),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      storeBanner: {
        findUnique: jest.fn(),
      },
      pushSubscription: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      customer: {
        findMany: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      scheduledNotification: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      brandConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      autoOfferSettings: { findUnique: jest.fn().mockResolvedValue({ minDiscount: 15 }) },
      product: { findUnique: jest.fn() },
      promotionCampaign: { updateMany: jest.fn() },
    }
    const pushNotificationService = {
      sendNotification: jest.fn().mockResolvedValue({ sent: 1, failed: 0, skipped: 0 }),
      notifyStatusChange: jest.fn().mockResolvedValue(undefined),
    }
    const whatsAppService = {
      sendStatusUpdate: jest.fn().mockResolvedValue(null),
      sendOrderConfirmation: jest.fn().mockResolvedValue(null),
    }

    return {
      service: new NotificationsService(prisma as any, pushNotificationService as any, whatsAppService as any),
      prisma,
      pushNotificationService,
      whatsAppService,
    }
  }

  it('cria notificacao e dispara Web Push quando ha cliente', async () => {
    const { service, prisma, pushNotificationService } = makeService()

    const notification = await service.create({
      type: 'PROMO',
      title: 'Oferta do dia',
      body: 'Confira as ofertas no mercado.',
      customerId: 'customer-1',
    })

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        type: 'PROMO',
        title: 'Oferta do dia',
        body: 'Confira as ofertas no mercado.',
        customerId: 'customer-1',
        source: 'MANUAL',
      },
    })
    // ?n=<id> no destino: o site registra o clique no aviso.
    expect(pushNotificationService.sendNotification).toHaveBeenCalledWith('customer-1', {
      title: 'Oferta do dia',
      body: 'Confira as ofertas no mercado.',
      url: '/?n=notif-1',
    })
    expect(notification).toMatchObject({
      id: 'notif-1',
      read: false,
      type: 'PROMO',
      title: 'Oferta do dia',
      body: 'Confira as ofertas no mercado.',
      customerId: 'customer-1',
    })
  })

  it('mudanca de status manda UM push so (sino e push usam o mesmo titulo/corpo)', async () => {
    const { service, prisma, pushNotificationService, whatsAppService } = makeService()
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      customerId: 'customer-1',
      customer: { id: 'customer-1', name: 'Jonathan', whatsapp: '24999999999' },
    })

    await service.notifyOrderStatusChange('order-1', 'CONFIRMED')

    expect(prisma.notification.create).toHaveBeenCalledTimes(1)
    // Ate 12/09/2026 havia um segundo caminho (pushNotificationService
    // .notifyStatusChange) chamado junto com create() pro MESMO evento --
    // cliente recebia dois avisos diferentes por mudanca de status. Removido:
    // agora e uma unica chamada, com o titulo/corpo com emoji direto no create().
    expect(pushNotificationService.sendNotification).toHaveBeenCalledTimes(1)
    expect(pushNotificationService.sendNotification).toHaveBeenCalledWith('customer-1', {
      title: '✅ Pedido Confirmado',
      body: 'Pedido #ORDER-1 confirmado e em preparo',
      image: undefined,
      url: '/account?n=notif-1',
    })
    expect(whatsAppService.sendStatusUpdate).toHaveBeenCalled()
  })

  it('status sem meta cadastrada: nao cria nada e nao quebra', async () => {
    const { service, prisma, pushNotificationService } = makeService()
    prisma.order.findUnique.mockResolvedValue({ id: 'order-2', customerId: 'customer-1', customer: {} })

    await service.notifyOrderStatusChange('order-2', 'ALGO_NOVO_SEM_META')

    expect(prisma.notification.create).not.toHaveBeenCalled()
    expect(pushNotificationService.sendNotification).not.toHaveBeenCalled()
  })

  it('broadcastToCustomers: resolve o banner UMA vez e manda push em paralelo pra todos', async () => {
    const { service, prisma, pushNotificationService } = makeService()
    prisma.storeBanner.findUnique.mockResolvedValue({ linkType: 'CATEGORY', linkValue: 'bebidas', desktopImageUrl: '/banner.webp' })

    const resultado = await service.broadcastToCustomers(['c1', 'c2', 'c3'], {
      type: 'PROMO',
      title: 'Oferta',
      body: 'Confira',
      bannerId: 'banner-1',
    })

    expect(prisma.storeBanner.findUnique).toHaveBeenCalledTimes(1)
    const { data } = prisma.notification.createMany.mock.calls[0][0]
    expect(data.map((d: any) => d.customerId)).toEqual(['c1', 'c2', 'c3'])
    expect(data.every((d: any) => d.imageUrl === '/banner.webp' && d.batchId === data[0].batchId && d.source === 'MANUAL')).toBe(true)
    expect(pushNotificationService.sendNotification).toHaveBeenCalledTimes(3)
    // Cada cliente recebe o proprio id na URL (clique medido por pessoa).
    const urls = pushNotificationService.sendNotification.mock.calls.map((c: any) => c[1].url)
    expect(urls).toEqual(data.map((d: any) => expect.stringContaining(`n=${d.id}`)))
    expect(resultado).toMatchObject({ count: 3 })
  })

  it('aceita subscription do formato PushSubscriptionJSON do navegador', async () => {
    const { service, prisma } = makeService()

    await service.savePushSubscription('customer-1', {
      endpoint: 'https://push.example/sub',
      keys: {
        auth: 'auth-key',
        p256dh: 'p256dh-key',
      },
    })

    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example/sub' },
      // adminId: null zera dono anterior -- o mesmo aparelho pode ter sido
      // inscrito como funcionario (a constraint do banco exige UM dono).
      update: { customerId: 'customer-1', adminId: null, auth: 'auth-key', p256dh: 'p256dh-key' },
      create: {
        customerId: 'customer-1',
        endpoint: 'https://push.example/sub',
        auth: 'auth-key',
        p256dh: 'p256dh-key',
      },
    })
  })

  // JON-148 (Auditoria 360): logout precisa desvincular a inscricao deste
  // aparelho -- sem isso, a proxima pessoa a entrar continuava recebendo
  // push da conta anterior.
  describe('deletePushSubscriptionByEndpoint', () => {
    it('remove so se o endpoint pertencer ao customerId informado', async () => {
      const { service, prisma } = makeService()
      prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 })

      const result = await service.deletePushSubscriptionByEndpoint('https://push.example/sub', { customerId: 'customer-1' })

      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { endpoint: 'https://push.example/sub', customerId: 'customer-1' },
      })
      expect(result).toEqual({ ok: true })
    })

    it('remove so se o endpoint pertencer ao adminId informado', async () => {
      const { service, prisma } = makeService()
      prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 })

      await service.deletePushSubscriptionByEndpoint('https://push.example/sub', { adminId: 'admin-1' })

      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { endpoint: 'https://push.example/sub', adminId: 'admin-1' },
      })
    })

    it('nao apaga inscricao de outro dono (count 0)', async () => {
      const { service, prisma } = makeService()
      prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 0 })

      const result = await service.deletePushSubscriptionByEndpoint('https://push.example/sub', { customerId: 'customer-2' })

      expect(result).toEqual({ ok: false })
    })
  })

  describe('findCustomerIdsBySegment', () => {
    it('sem filtro: retorna todos os clientes (comportamento antigo)', async () => {
      const { service, prisma } = makeService()
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }])

      const ids = await service.findCustomerIdsBySegment({})

      expect(ids).toEqual(['c1', 'c2'])
      expect(prisma.order.findMany).not.toHaveBeenCalled()
      expect(prisma.order.groupBy).not.toHaveBeenCalled()
    })

    it('so purchasedCategory: retorna clientes com pedido na categoria', async () => {
      const { service, prisma } = makeService()
      prisma.order.findMany.mockResolvedValue([{ customerId: 'c1' }, { customerId: 'c2' }])

      const ids = await service.findCustomerIdsBySegment({ purchasedCategory: 'vinhos' })

      expect(ids).toEqual(['c1', 'c2'])
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { items: { some: { product: { category: 'vinhos' } } } },
        select: { customerId: true },
        distinct: ['customerId'],
      })
      expect(prisma.customer.findMany).not.toHaveBeenCalled()
    })

    it('so inactiveDays: exclui quem comprou depois do corte', async () => {
      const { service, prisma } = makeService()
      const now = Date.now()
      prisma.order.groupBy.mockResolvedValue([
        { customerId: 'ativo', _max: { createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000) } },
        { customerId: 'inativo', _max: { createdAt: new Date(now - 60 * 24 * 60 * 60 * 1000) } },
      ])
      prisma.customer.findMany.mockResolvedValue([{ id: 'ativo' }, { id: 'inativo' }, { id: 'sempedido' }])

      const ids = await service.findCustomerIdsBySegment({ inactiveDays: 30 })

      expect(ids.sort()).toEqual(['inativo', 'sempedido'].sort())
    })

    it('inactiveDays + purchasedCategory: intersecao (E, nao OU)', async () => {
      const { service, prisma } = makeService()
      const now = Date.now()
      prisma.order.findMany.mockResolvedValue([{ customerId: 'c1' }, { customerId: 'c2' }])
      prisma.order.groupBy.mockResolvedValue([
        { customerId: 'c1', _max: { createdAt: new Date(now - 60 * 24 * 60 * 60 * 1000) } },
      ])
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }])

      const ids = await service.findCustomerIdsBySegment({ inactiveDays: 30, purchasedCategory: 'vinhos' })

      expect(ids.sort()).toEqual(['c1', 'c2'])
    })
  })

  describe('fila de envios: dispatchDueQueue (02/10/2026)', () => {
    const item = (over: Record<string, unknown> = {}) => ({
      id: 'q1',
      origin: 'MANUAL',
      status: 'SCHEDULED',
      type: 'PROMO',
      title: 'Oferta',
      body: 'Confira',
      url: null,
      customerId: 'customer-1',
      customerIds: [],
      imageUrl: null,
      productId: null,
      bannerId: null,
      inactiveDays: null,
      purchasedCategory: null,
      respectHours: false,
      expiresAt: null,
      meta: null,
      ...over,
    })
    const ready = (prisma: any, it: any) => {
      prisma.scheduledNotification.findMany.mockResolvedValue([it])
      prisma.scheduledNotification.findUnique.mockResolvedValue(it)
      prisma.customer.findMany.mockImplementation(({ where }: any) => Promise.resolve((where.id.in as string[]).map((id) => ({ id }))))
      prisma.pushSubscription.findMany.mockResolvedValue([])
      prisma.notification.findMany.mockResolvedValue([])
    }

    it('envia o que venceu: claim atomico, grava enviado com quantos e o lote', async () => {
      const { service, prisma } = makeService()
      ready(prisma, item())

      const result = await service.dispatchDueQueue()

      expect(prisma.scheduledNotification.updateMany).toHaveBeenCalledWith({ where: { id: 'q1', status: 'SCHEDULED' }, data: { status: 'SENDING' } })
      expect(prisma.scheduledNotification.update).toHaveBeenCalledWith({
        where: { id: 'q1' },
        data: expect.objectContaining({ status: 'SENT', sentCount: 1, batchId: expect.any(String) }),
      })
      expect(prisma.notification.createMany.mock.calls[0][0].data[0].source).toBe('SCHEDULED')
      expect(result).toEqual({ count: 1 })
    })

    it('corrida (JON-158): se outro processo ja reivindicou, nao reenvia', async () => {
      const { service, prisma } = makeService()
      ready(prisma, item())
      prisma.scheduledNotification.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 })

      expect(await service.dispatchDueQueue()).toEqual({ count: 0 })
      expect(prisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('automatico com a loja fechada espera a abertura (nem reivindica)', async () => {
      const { service, prisma } = makeService()
      ready(prisma, item({ respectHours: true }))
      // Horario valido so num domingo de 2020: hoje nunca cai nele.
      prisma.brandConfig.findUnique.mockResolvedValue({ businessHours: '{}', specialDates: JSON.stringify([{ date: '2020-01-05', windows: [{ start: '00:00', end: '23:59' }] }]) })

      expect(await service.dispatchDueQueue()).toEqual({ count: 0 })
      expect(prisma.scheduledNotification.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'SENDING' } }))
    })

    it('passou do horario-limite sem sair: vira "nao saiu" com o motivo', async () => {
      const { service, prisma } = makeService()
      ready(prisma, item({ expiresAt: new Date(Date.now() - 60_000) }))

      expect(await service.dispatchDueQueue()).toEqual({ count: 0 })
      expect(prisma.scheduledNotification.updateMany).toHaveBeenCalledWith({
        where: { id: 'q1', status: 'SCHEDULED' },
        data: expect.objectContaining({ status: 'SKIPPED' }),
      })
    })

    it('oferta que acabou antes do envio: nao sai e diz por que', async () => {
      const { service, prisma } = makeService()
      ready(prisma, item({ origin: 'OFERTA', productId: 'p1', customerId: null, customerIds: ['customer-1'] }))
      prisma.product.findUnique.mockResolvedValue({ active: true, syncOption: 'SEMPRE', stock: 1, price: 10, promotionalPrice: null })

      expect(await service.dispatchDueQueue()).toEqual({ count: 0 })
      expect(prisma.scheduledNotification.update).toHaveBeenCalledWith({ where: { id: 'q1' }, data: { status: 'SKIPPED', note: 'A oferta acabou antes do envio.' } })
    })

    it('oferta: quem recebeu outro aviso de marketing nas ultimas 20h fica de fora', async () => {
      const { service, prisma } = makeService()
      ready(prisma, item({ origin: 'OFERTA', productId: 'p1', customerId: null, customerIds: ['customer-1', 'customer-2'] }))
      prisma.product.findUnique.mockResolvedValue({ active: true, syncOption: 'SEMPRE', stock: 1, price: 10, promotionalPrice: 7 })
      prisma.notification.findMany.mockResolvedValue([{ customerId: 'customer-1' }])

      await service.dispatchDueQueue()

      const rows = prisma.notification.createMany.mock.calls[0][0].data
      expect(rows.map((r: any) => r.customerId)).toEqual(['customer-2'])
      expect(rows[0].source).toBe('AUTO')
    })

    it('aviso de encarte marca o encarte como avisado', async () => {
      const { service, prisma } = makeService()
      ready(prisma, item({ origin: 'ENCARTE_FIM', type: 'CAMPAIGN', customerId: 'customer-1', meta: { campaignId: 'c1' } }))

      await service.dispatchDueQueue()

      expect(prisma.notification.createMany.mock.calls[0][0].data[0].source).toBe('ENCARTE')
      expect(prisma.promotionCampaign.updateMany).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { endingNotifiedAt: expect.any(Date) } })
    })
  })
})
