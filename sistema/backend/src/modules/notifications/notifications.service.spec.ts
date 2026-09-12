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
      },
      customer: {
        findMany: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
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
      },
    })
    expect(pushNotificationService.sendNotification).toHaveBeenCalledWith('customer-1', {
      title: 'Oferta do dia',
      body: 'Confira as ofertas no mercado.',
      url: '/',
    })
    expect(notification).toEqual({
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
      url: '/account',
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
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        { type: 'PROMO', title: 'Oferta', body: 'Confira', customerId: 'c1', imageUrl: '/banner.webp', productId: undefined },
        { type: 'PROMO', title: 'Oferta', body: 'Confira', customerId: 'c2', imageUrl: '/banner.webp', productId: undefined },
        { type: 'PROMO', title: 'Oferta', body: 'Confira', customerId: 'c3', imageUrl: '/banner.webp', productId: undefined },
      ],
    })
    expect(pushNotificationService.sendNotification).toHaveBeenCalledTimes(3)
    expect(resultado).toEqual({ count: 3 })
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
})
