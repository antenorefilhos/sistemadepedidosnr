import { ForbiddenException, HttpException, UnauthorizedException } from '@nestjs/common'
import axios from 'axios'
import { PublicApiService } from './public-api.service'

jest.mock('axios', () => ({
  post: jest.fn(),
}))

// JON-141: assertPublicHttpsEndpoint faz DNS real -- 'example.local' e
// reservado (mDNS) e nao resolve em CI/dev. Mocka aqui; a validacao em si
// tem spec propria (assert-public-endpoint.spec.ts).
jest.mock('../../common/security/assert-public-endpoint', () => ({
  assertPublicHttpsEndpoint: jest.fn().mockResolvedValue(undefined),
}))

import { assertPublicHttpsEndpoint } from '../../common/security/assert-public-endpoint'

const mockPrisma: any = {
  apiClient: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  apiUsageLog: {
    create: jest.fn(),
    count: jest.fn(),
  },
  order: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  orderEvent: {
    findMany: jest.fn(),
  },
  product: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  stockPosition: {
    findMany: jest.fn(),
  },
  webhookEndpoint: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  webhookDelivery: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

describe('PublicApiService', () => {
  let service: PublicApiService

  beforeEach(() => {
    service = new PublicApiService(mockPrisma)
    mockPrisma.apiUsageLog.create.mockResolvedValue({ id: 'log-1' })
    mockPrisma.apiUsageLog.count.mockResolvedValue(0)
    mockPrisma.apiClient.update.mockResolvedValue({})
    jest.clearAllMocks()
  })

  it('creates an API client with hashed secret and raw key returned once', async () => {
    mockPrisma.apiClient.create.mockImplementation(async ({ data }: any) => ({
      id: 'client-1',
      ...data,
    }))

    const result = await service.createClient({
      name: 'ERP externo',
      scopes: ['Orders.Read', 'stock.read'],
      rateLimitPerMinute: 50,
    }, { tenantId: 'tenant_default', storeId: 'store_default' })

    expect(result.apiKey).toMatch(/^ak_[a-f0-9]+\.[a-f0-9]+$/)
    expect(result.secret).not.toBe(result.client.secretHash)
    expect(mockPrisma.apiClient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scopes: ['orders.read', 'stock.read'],
          secretHash: PublicApiService.hashSecret(result.secret),
          rateLimitPerMinute: 50,
        }),
      }),
    )
  })

  it('authenticates active clients, enforces scope and writes usage log', async () => {
    const secret = 'secret-123'
    const client = {
      id: 'client-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      clientId: 'ak_client',
      secretHash: PublicApiService.hashSecret(secret),
      scopes: ['orders.read'],
      status: 'ACTIVE',
      rateLimitPerMinute: 10,
    }
    mockPrisma.apiClient.findUnique.mockResolvedValue(client)

    const result = await service.authenticate('ak_client.secret-123', 'orders.read', {
      path: '/v1/orders',
      method: 'GET',
    })

    expect(result).toBe(client)
    expect(mockPrisma.apiClient.update).toHaveBeenCalledWith({
      where: { id: 'client-1' },
      data: { lastUsedAt: expect.any(Date) },
    })
    expect(mockPrisma.apiUsageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ apiClientId: 'client-1', allowed: true, scope: 'orders.read' }),
      }),
    )
  })

  it('blocks revoked clients and clients without the required scope', async () => {
    const secret = 'secret-123'
    mockPrisma.apiClient.findUnique.mockResolvedValueOnce({
      id: 'client-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      clientId: 'ak_client',
      secretHash: PublicApiService.hashSecret(secret),
      scopes: ['orders.read'],
      status: 'REVOKED',
      rateLimitPerMinute: 10,
    })

    await expect(service.authenticate('ak_client.secret-123', 'orders.read', { path: '/v1/orders', method: 'GET' }))
      .rejects.toThrow(UnauthorizedException)

    mockPrisma.apiClient.findUnique.mockResolvedValueOnce({
      id: 'client-2',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      clientId: 'ak_client2',
      secretHash: PublicApiService.hashSecret(secret),
      scopes: ['stock.read'],
      status: 'ACTIVE',
      rateLimitPerMinute: 10,
    })

    await expect(service.authenticate('ak_client2.secret-123', 'orders.read', { path: '/v1/orders', method: 'GET' }))
      .rejects.toThrow(ForbiddenException)
  })

  it('rate-limits clients by one-minute usage window', async () => {
    const secret = 'secret-123'
    mockPrisma.apiClient.findUnique.mockResolvedValue({
      id: 'client-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      clientId: 'ak_client',
      secretHash: PublicApiService.hashSecret(secret),
      scopes: ['*'],
      status: 'ACTIVE',
      rateLimitPerMinute: 1,
    })
    mockPrisma.apiUsageLog.count.mockResolvedValue(1)

    await expect(service.authenticate('ak_client.secret-123', 'orders.read', { path: '/v1/orders', method: 'GET' }))
      .rejects.toThrow(HttpException)
  })

  it('creates signed webhook deliveries and retries failed delivery into queue state', async () => {
    const endpoint = {
      id: 'wh-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      url: 'https://example.local/webhook',
      secret: 'whsec',
      events: ['order.created'],
      status: 'ACTIVE',
    }
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([endpoint])
    mockPrisma.webhookDelivery.create.mockImplementation(async ({ data }: any) => ({ id: 'del-1', ...data }))

    const emitted = await service.emitWebhookEvent('order.created', { orderId: 'order-1' })

    expect(emitted.deliveries).toHaveLength(1)
    expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ endpointId: 'wh-1', eventType: 'order.created', status: 'PENDING' }),
      }),
    )

    mockPrisma.webhookDelivery.findUnique.mockResolvedValue({
      id: 'del-1',
      eventType: 'order.created',
      payload: { id: emitted.eventId, type: 'order.created', data: { orderId: 'order-1' } },
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 5,
      endpoint,
    })
    ;(axios.post as jest.Mock).mockRejectedValue(new Error('timeout'))
    mockPrisma.webhookDelivery.update.mockResolvedValue({ id: 'del-1', status: 'FAILED' })

    const result = await service.processWebhookDelivery('del-1')

    expect(axios.post).toHaveBeenCalledWith(
      endpoint.url,
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-antenor-signature': expect.stringMatching(/^sha256=/),
        }),
      }),
    )
    expect(result.status).toBe('FAILED')
    expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', attempts: { increment: 1 }, nextRetryAt: expect.any(Date) }),
      }),
    )
  })

  // JON-141 (Auditoria 360): webhook de saida sem validar destino e SSRF --
  // admin (ou sessao comprometida) cadastra URL de rede interna e o worker
  // vira proxy pra ela. Confere que a validacao e chamada de verdade nos
  // dois pontos: cadastro e no instante do envio (rebinding).
  it('recusa cadastrar webhook quando o destino nao e publico', async () => {
    ;(assertPublicHttpsEndpoint as jest.Mock).mockRejectedValueOnce(new Error('destino nao permitido'))

    await expect(
      service.createWebhookEndpoint({ url: 'https://169.254.169.254/latest/meta-data', events: ['order.created'] }),
    ).rejects.toThrow('destino nao permitido')
    expect(mockPrisma.webhookEndpoint.create).not.toHaveBeenCalled()
  })

  it('nao chama axios.post quando o destino deixou de ser publico entre o cadastro e o envio (DNS rebinding)', async () => {
    const endpoint = {
      id: 'wh-2', tenantId: 'tenant_default', storeId: 'store_default',
      url: 'https://dominio-que-mudou.example/webhook', secret: 'whsec', events: ['order.created'], status: 'ACTIVE',
    }
    mockPrisma.webhookDelivery.findUnique.mockResolvedValue({
      id: 'del-2', eventType: 'order.created', payload: { id: 'evt-2', type: 'order.created', data: {} },
      status: 'PENDING', attempts: 0, maxAttempts: 5, endpoint,
    })
    ;(assertPublicHttpsEndpoint as jest.Mock).mockRejectedValueOnce(new Error('destino nao permitido'))
    ;(axios.post as jest.Mock).mockClear()
    mockPrisma.webhookDelivery.update.mockResolvedValue({ id: 'del-2', status: 'FAILED' })

    // Cai no mesmo catch/retry de qualquer falha de entrega -- nao lanca,
    // vira FAILED/DEAD como um timeout de rede normal faria.
    const result = await service.processWebhookDelivery('del-2')

    expect(axios.post).not.toHaveBeenCalled()
    expect(result.status).toMatch(/FAILED|DEAD/)
    expect(result.error).toContain('destino nao permitido')
  })
})
