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
    }
    const pushNotificationService = {
      sendNotification: jest.fn().mockResolvedValue({ sent: 1, failed: 0, skipped: 0 }),
    }

    return {
      service: new NotificationsService(prisma as any, pushNotificationService as any),
      prisma,
      pushNotificationService,
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
      update: { customerId: 'customer-1', auth: 'auth-key', p256dh: 'p256dh-key' },
      create: {
        customerId: 'customer-1',
        endpoint: 'https://push.example/sub',
        auth: 'auth-key',
        p256dh: 'p256dh-key',
      },
    })
  })
})
