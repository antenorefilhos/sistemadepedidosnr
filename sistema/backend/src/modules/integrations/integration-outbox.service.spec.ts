import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../common/prisma.service'
import { IntegrationOutboxService } from './integration-outbox.service'

const mockPrisma = {
  integrationConnector: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  outboxEvent: {
    count: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  integrationJob: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  integrationAttempt: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  integrationDeadLetter: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}

describe('IntegrationOutboxService', () => {
  let service: IntegrationOutboxService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationOutboxService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get<IntegrationOutboxService>(IntegrationOutboxService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('cria conector idempotente por tenant loja tipo e provedor', async () => {
    mockPrisma.integrationConnector.upsert.mockResolvedValue({ id: 'conn-1', type: 'ERP', provider: 'SOLIDCOM' })

    const result = await service.createConnector({
      type: 'erp',
      provider: 'solidcom',
      config: { endpoint: 'https://erp.local' },
    })

    expect(result.id).toBe('conn-1')
    expect(mockPrisma.integrationConnector.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_storeId_type_provider: {
            tenantId: 'tenant_default',
            storeId: 'store_default',
            type: 'ERP',
            provider: 'SOLIDCOM',
          },
        },
      }),
    )
  })

  it('enfileira evento com idempotencia por mensagem', async () => {
    mockPrisma.integrationConnector.findUnique.mockResolvedValue({ id: 'conn-1', status: 'ACTIVE' })
    mockPrisma.outboxEvent.findFirst.mockResolvedValue(null)
    mockPrisma.outboxEvent.create.mockImplementation(async ({ data }) => ({ id: 'evt-1', ...data }))

    const result = await service.enqueueEvent({
      connectorId: 'conn-1',
      aggregate: 'order',
      aggregateId: 'order-1',
      type: 'order_sync_to_erp',
      payload: { orderId: 'order-1' },
      idempotencyKey: 'idem-1',
    })

    expect(result.duplicate).toBe(false)
    expect(result.event).toEqual(expect.objectContaining({ id: 'evt-1', type: 'ORDER_SYNC_TO_ERP' }))
    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          connectorId: 'conn-1',
          idempotencyKey: 'idem-1',
          status: 'PENDING',
        }),
      }),
    )
  })

  it('processa evento pendente e registra job e tentativa enviados', async () => {
    const event = {
      id: 'evt-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      connectorId: 'conn-1',
      connector: { id: 'conn-1', status: 'ACTIVE' },
      aggregate: 'ORDER',
      aggregateId: 'order-1',
      type: 'ORDER_SYNC_TO_ERP',
      payload: { orderId: 'order-1' },
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 5,
      idempotencyKey: 'idem-1',
      lastError: null,
    }
    mockPrisma.outboxEvent.findUnique.mockResolvedValue(event)
    mockPrisma.integrationJob.create.mockResolvedValue({ id: 'job-1' })
    mockPrisma.integrationAttempt.create.mockResolvedValue({ id: 'attempt-1' })
    mockPrisma.integrationAttempt.update.mockResolvedValue({})
    mockPrisma.integrationJob.update.mockResolvedValue({})
    mockPrisma.outboxEvent.update.mockResolvedValue({})

    const result = await service.processOutboxEvent('evt-1')

    expect(result).toEqual(expect.objectContaining({ status: 'SENT', jobId: 'job-1' }))
    expect(mockPrisma.integrationAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'attempt-1' },
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    )
    expect(mockPrisma.outboxEvent.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'evt-1' },
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    )
  })

  it('move para DLQ quando excede maxAttempts', async () => {
    const event = {
      id: 'evt-dead',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      connectorId: 'conn-1',
      connector: { id: 'conn-1', status: 'ACTIVE' },
      aggregate: 'ORDER',
      aggregateId: 'order-1',
      type: 'ORDER_SYNC_TO_ERP',
      payload: { orderId: 'order-1' },
      status: 'FAILED',
      attempts: 5,
      maxAttempts: 5,
      idempotencyKey: 'idem-1',
      lastError: 'timeout',
    }
    mockPrisma.outboxEvent.findUnique.mockResolvedValue(event)
    mockPrisma.outboxEvent.update.mockResolvedValue({})
    mockPrisma.integrationDeadLetter.create.mockResolvedValue({ id: 'dlq-1' })

    const result = await service.processOutboxEvent('evt-dead')

    expect(result.status).toBe('DEAD')
    expect(mockPrisma.integrationDeadLetter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outboxEventId: 'evt-dead',
          reason: 'timeout',
        }),
      }),
    )
  })

  it('replay de DLQ cria novo evento e marca dead letter resolvida', async () => {
    mockPrisma.integrationDeadLetter.findUnique.mockResolvedValue({
      id: 'dlq-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      connectorId: 'conn-1',
      payload: { orderId: 'order-1' },
      replayCount: 0,
    })
    mockPrisma.outboxEvent.create.mockResolvedValue({ id: 'evt-replay' })
    mockPrisma.integrationDeadLetter.update.mockResolvedValue({})

    const result = await service.replayDeadLetter('dlq-1')

    expect(result).toEqual({ deadLetterId: 'dlq-1', replayEventId: 'evt-replay' })
    expect(mockPrisma.integrationDeadLetter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dlq-1' },
        data: expect.objectContaining({ resolvedAt: expect.any(Date) }),
      }),
    )
  })
})
