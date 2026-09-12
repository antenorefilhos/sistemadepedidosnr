import { NotificationsService } from './notifications.service'

describe('NotificationsService', () => {
  function makeService() {
    const prisma = {
      notification: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'notif-1', read: false, ...data })),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
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

  it('mudanca de status manda UM push so, nao dois -- create() nao duplica o de notifyStatusChange', async () => {
    const { service, prisma, pushNotificationService, whatsAppService } = makeService()
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      customerId: 'customer-1',
      customer: { id: 'customer-1', name: 'Jonathan', whatsapp: '24999999999' },
    })

    await service.notifyOrderStatusChange('order-1', 'CONFIRMED')

    // O registro pro sino/historico sempre e criado...
    expect(prisma.notification.create).toHaveBeenCalledTimes(1)
    // ...mas o push generico de dentro de create() fica de fora pra ORDER_UPDATE --
    // quem manda o push aqui e notifyStatusChange (copy com emoji por status).
    expect(pushNotificationService.sendNotification).not.toHaveBeenCalled()
    expect(pushNotificationService.notifyStatusChange).toHaveBeenCalledWith('customer-1', 'ORDER-1', 'CONFIRMED')
    expect(whatsAppService.sendStatusUpdate).toHaveBeenCalled()
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
