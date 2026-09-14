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
    upsert: jest.fn(),
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

  // JON-48 (Auditoria 360, High): este teste validava o falso sucesso --
  // dispatchEvent nunca chamava integracao nenhuma e o worker marcava SENT
  // mesmo assim. Sem dispatcher real registrado, o resultado honesto e
  // FAILED explicito (nao "sumir" a falha atras de um SENT mentiroso).
  it('nao marca SENT sem um dispatcher real -- falha explicita em vez de falso sucesso', async () => {
    const event = {
      id: 'evt-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      connectorId: 'conn-1',
      connector: { id: 'conn-1', status: 'ACTIVE', provider: 'SOLIDCOM' },
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
    mockPrisma.integrationJob.upsert.mockResolvedValue({ id: 'job-1' })
    mockPrisma.integrationAttempt.create.mockResolvedValue({ id: 'attempt-1' })
    mockPrisma.integrationAttempt.update.mockResolvedValue({})
    mockPrisma.integrationJob.update.mockResolvedValue({})
    mockPrisma.outboxEvent.update.mockResolvedValue({})

    const result = await service.processOutboxEvent('evt-1')

    expect(result).toEqual(expect.objectContaining({ status: 'FAILED', jobId: 'job-1' }))
    expect(mockPrisma.integrationAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'attempt-1' },
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    )
    expect(mockPrisma.outboxEvent.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
    )
  })

  // JON-49 (Auditoria 360, High): a mesma idempotencyKey era usada em
  // integrationJob.create() em toda tentativa, contra um @@unique -- a
  // segunda tentativa de um evento que falhou antes estourava P2002 e o
  // retry nunca rodava de verdade. upsert() evita isso.
  it('processa retry do mesmo evento sem duplicar job (upsert, nao create)', async () => {
    const event = {
      id: 'evt-retry',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      connectorId: 'conn-1',
      connector: { id: 'conn-1', status: 'ACTIVE', provider: 'SOLIDCOM' },
      aggregate: 'ORDER',
      aggregateId: 'order-1',
      type: 'ORDER_SYNC_TO_ERP',
      payload: { orderId: 'order-1' },
      status: 'FAILED',
      attempts: 1,
      maxAttempts: 5,
      idempotencyKey: 'idem-retry',
      lastError: 'falha anterior',
    }
    mockPrisma.outboxEvent.findUnique.mockResolvedValue(event)
    mockPrisma.integrationJob.upsert.mockResolvedValue({ id: 'job-1' })
    mockPrisma.integrationAttempt.create.mockResolvedValue({ id: 'attempt-2' })
    mockPrisma.integrationAttempt.update.mockResolvedValue({})
    mockPrisma.outboxEvent.update.mockResolvedValue({})

    const result = await service.processOutboxEvent('evt-retry')

    expect(mockPrisma.integrationJob.create).not.toHaveBeenCalled()
    expect(mockPrisma.integrationJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_storeId_connectorId_idempotencyKey: {
            tenantId: 'tenant_default',
            storeId: 'store_default',
            connectorId: 'conn-1',
            idempotencyKey: 'job:idem-retry',
          },
        },
      }),
    )
    expect(result.status).toBe('FAILED') // sem dispatcher real (JON-48), mas chegou ate aqui sem estourar P2002
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
