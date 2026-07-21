import { PushNotificationService } from './push-notification.service'

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}))

const webpush = require('web-push') as {
  setVapidDetails: jest.Mock
  sendNotification: jest.Mock
}

describe('PushNotificationService', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      VAPID_PUBLIC_KEY: 'public-key',
      VAPID_PRIVATE_KEY: 'private-key',
      VAPID_SUBJECT: 'mailto:dev@antenor.com.br',
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  function makeService(prismaOverrides: Record<string, any> = {}) {
    const prisma = {
      pushSubscription: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        ...prismaOverrides,
      },
    }

    return {
      service: new PushNotificationService(prisma as any),
      prisma,
    }
  }

  it('configura VAPID e envia payload para subscriptions do cliente', async () => {
    webpush.sendNotification.mockResolvedValue({})
    const { service, prisma } = makeService({
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'sub-1',
          customerId: 'customer-1',
          endpoint: 'https://push.example/sub-1',
          auth: 'auth-key',
          p256dh: 'p256dh-key',
        },
      ]),
    })

    const result = await service.sendNotification('customer-1', {
      title: 'Oferta relampago',
      body: 'Tem promocao nova no mercado.',
      icon: '/icon.png',
      url: '/mercado',
    })

    expect(webpush.setVapidDetails).toHaveBeenCalledWith('mailto:dev@antenor.com.br', 'public-key', 'private-key')
    expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({ where: { customerId: 'customer-1' } })
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: 'https://push.example/sub-1',
        keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
      },
      JSON.stringify({
        title: 'Oferta relampago',
        body: 'Tem promocao nova no mercado.',
        icon: '/icon.png',
        url: '/mercado',
      }),
    )
    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 })
  })

  it('remove subscription expirada quando provider retorna 410', async () => {
    webpush.sendNotification.mockRejectedValue({ statusCode: 410 })
    const { service, prisma } = makeService({
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'sub-expired',
          customerId: 'customer-1',
          endpoint: 'https://push.example/expired',
          auth: 'auth-key',
          p256dh: 'p256dh-key',
        },
      ]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    })

    const result = await service.sendNotification('customer-1', {
      title: 'Pedido atualizado',
      body: 'Seu pedido mudou de status.',
    })

    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example/expired' },
    })
    expect(result).toEqual({ sent: 0, failed: 1, skipped: 0 })
  })

  it('nao envia push quando VAPID nao esta configurado', async () => {
    process.env = {
      ...originalEnv,
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: '',
    }
    const { service } = makeService()

    const result = await service.sendNotification('customer-1', {
      title: 'Sem VAPID',
      body: 'Push deve ser ignorado.',
    })

    expect(webpush.sendNotification).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 })
  })
})
