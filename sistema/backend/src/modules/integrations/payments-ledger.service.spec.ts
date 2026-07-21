import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../common/prisma.service'
import { PublicApiService } from '../public-api/public-api.service'
import { PaymentsLedgerService } from './payments-ledger.service'

const mockPrisma = {
  paymentTransaction: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  paymentEvent: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  refund: {
    aggregate: jest.fn(),
    create: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  paymentReconciliationRun: {
    create: jest.fn(),
  },
}

const mockPublicApiService = {
  emitWebhookEvent: jest.fn().mockResolvedValue({ deliveries: [] }),
}

describe('PaymentsLedgerService', () => {
  let service: PaymentsLedgerService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsLedgerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PublicApiService, useValue: mockPublicApiService },
      ],
    }).compile()

    service = module.get<PaymentsLedgerService>(PaymentsLedgerService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('cria transacao idempotente e sanitiza payload sensivel', async () => {
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue(null)
    mockPrisma.paymentTransaction.create.mockImplementation(async ({ data }) => ({ id: 'tx-1', ...data }))

    const result = await service.createTransaction({
      tenantId: 'tenant_default',
      storeId: 'store_default',
      orderId: 'order-1',
      provider: 'gateway',
      method: 'PIX',
      status: 'PENDING',
      amount: 42.5,
      providerRef: 'charge-1',
      idempotencyKey: 'idem-1',
      metadata: { cardNumber: '4111111111111111', nested: { token: 'secret', safe: 'ok' } },
    })

    expect(result.id).toBe('tx-1')
    expect(mockPrisma.paymentTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'GATEWAY',
          amount: expect.anything(),
          metadata: expect.objectContaining({
            cardNumber: '[REDACTED]',
            nested: expect.objectContaining({ token: '[REDACTED]', safe: 'ok' }),
          }),
        }),
      }),
    )
  })

  it('processa evento duplicado por providerEventId sem gravar novamente', async () => {
    mockPrisma.paymentEvent.findFirst.mockResolvedValue({ id: 'event-existing' })

    const result = await service.recordEvent({
      transactionId: 'tx-1',
      type: 'charge.paid',
      payload: { chargeId: 'charge-1' },
      signatureOk: true,
      providerEventId: 'evt-1',
    })

    expect(result.duplicate).toBe(true)
    expect(mockPrisma.paymentEvent.create).not.toHaveBeenCalled()
  })

  it('registra reembolso parcial e atualiza transacao', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      total: 100,
    })
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      orderId: 'order-1',
      amount: 100,
      status: 'CAPTURED',
    })
    mockPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    mockPrisma.refund.create.mockResolvedValue({ id: 'refund-1', amount: 25, status: 'SUCCEEDED' })
    mockPrisma.paymentTransaction.update.mockResolvedValue({ id: 'tx-1', status: 'PARTIALLY_REFUNDED' })
    mockPrisma.order.update.mockResolvedValue({ id: 'order-1', paymentStatus: 'PARTIALLY_REFUNDED' })

    const result = await service.createRefund({
      orderId: 'order-1',
      amount: 25,
      reason: 'Item cortado',
    })

    expect(result.id).toBe('refund-1')
    expect(mockPrisma.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-1' },
        data: expect.objectContaining({ status: 'PARTIALLY_REFUNDED' }),
      }),
    )
  })

  it('gera conciliacao com divergencia de valor visivel para financeiro', async () => {
    mockPrisma.paymentTransaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        orderId: 'order-1',
        providerRef: 'charge-1',
        amount: 100,
        status: 'CAPTURED',
      },
    ])
    mockPrisma.paymentReconciliationRun.create.mockImplementation(async ({ data }) => ({ id: 'run-1', ...data }))

    const result = await service.reconcile({
      provider: 'gateway',
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.000Z',
      providerRows: [{ providerRef: 'charge-1', amount: 95, status: 'captured' }],
    })

    expect(result.summary.amountMismatch).toBe(1)
    expect(result.report.amountMismatch[0]).toEqual(
      expect.objectContaining({
        providerRef: 'charge-1',
        localAmount: 100,
        providerAmount: 95,
        difference: -5,
      }),
    )
    expect(mockPrisma.paymentReconciliationRun.create).toHaveBeenCalled()
  })
})
