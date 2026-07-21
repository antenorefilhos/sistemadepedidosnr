import { createHmac } from 'crypto'
import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../common/prisma.service'
import { PaymentsWebhookService, WebhookPayload } from './payments-webhook.service'
import { PaymentsLedgerService } from './payments-ledger.service'

const FAKE_SECRET = 'test-secret-32bytes-xxxxxxxxxxxx'

function sign(body: object | string): { raw: Buffer; sig: string } {
  const raw = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
  const sig = createHmac('sha256', FAKE_SECRET).update(raw).digest('hex')
  return { raw, sig }
}

const mockPrisma = {
  auditLog: {
    create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

const mockPaymentsLedger = {
  createTransaction: jest.fn().mockResolvedValue({ id: 'tx-1', status: 'PENDING' }),
  recordEvent: jest.fn().mockResolvedValue({ event: { id: 'event-1' }, duplicate: false }),
  updateTransactionStatus: jest.fn().mockResolvedValue({ id: 'tx-1', status: 'CAPTURED' }),
}

describe('PaymentsWebhookService', () => {
  let service: PaymentsWebhookService
  const OLD_ENV = process.env

  beforeEach(async () => {
    process.env = { ...OLD_ENV, PAYMENTS_WEBHOOK_SECRET: FAKE_SECRET }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsWebhookService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaymentsLedgerService, useValue: mockPaymentsLedger },
      ],
    }).compile()

    service = module.get<PaymentsWebhookService>(PaymentsWebhookService)
  })

  afterEach(() => {
    process.env = OLD_ENV
    jest.clearAllMocks()
  })

  // ── verifySignature ─────────────────────────────────────────────────────────

  describe('verifySignature', () => {
    it('retorna true para assinatura HMAC-SHA256 válida', () => {
      const { raw, sig } = sign({ event: 'charge.paid' })
      expect(service.verifySignature(raw, sig)).toBe(true)
    })

    it('aceita prefixo sha256=', () => {
      const { raw, sig } = sign({ event: 'charge.paid' })
      expect(service.verifySignature(raw, `sha256=${sig}`)).toBe(true)
    })

    it('rejeita assinatura incorreta', () => {
      const { raw } = sign({ event: 'charge.paid' })
      expect(service.verifySignature(raw, 'aabbccdd')).toBe(false)
    })

    it('retorna true quando secret não está configurado (modo permissivo)', () => {
      delete process.env.PAYMENTS_WEBHOOK_SECRET
      const raw = Buffer.from('{}')
      expect(service.verifySignature(raw, 'qualquer')).toBe(true)
    })

    it('rejeita webhook sem secret quando gateway esta ativo', () => {
      delete process.env.PAYMENTS_WEBHOOK_SECRET
      process.env.ENABLE_PAYMENTS_INTEGRATION = 'true'
      const raw = Buffer.from('{}')
      expect(service.verifySignature(raw, 'qualquer')).toBe(false)
    })
  })

  // ── processEvent ────────────────────────────────────────────────────────────

  describe('processEvent', () => {
    const basePayload: WebhookPayload = {
      event: 'charge.paid',
      chargeId: 'charge-abc-123',
      orderId: 'order-xyz-456',
      status: 'paid',
      amount: 10000,
    }

    it('atualiza pedido para CONFIRMED em charge.paid e retorna processed=true', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null)
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'order-xyz-456', status: 'PENDING', paymentStatus: 'UNPAID' })
      mockPrisma.order.update.mockResolvedValue({ id: 'order-xyz-456', status: 'CONFIRMED', paymentStatus: 'PAID' })

      const result = await service.processEvent(basePayload)

      expect(result).toEqual({
        processed: true,
        orderId: 'order-xyz-456',
        newStatus: 'CONFIRMED',
        newPaymentStatus: 'PAID',
      })
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-xyz-456' },
        data: { status: 'CONFIRMED', paymentStatus: 'PAID' },
      })
    })

    it('atualiza pedido para CANCELLED em charge.failed', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null)
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'order-xyz-456', status: 'PENDING', paymentStatus: 'UNPAID' })
      mockPrisma.order.update.mockResolvedValue({ id: 'order-xyz-456', status: 'CANCELLED', paymentStatus: 'FAILED' })

      const result = await service.processEvent({ ...basePayload, event: 'charge.failed' })

      expect(result.newStatus).toBe('CANCELLED')
      expect(result.newPaymentStatus).toBe('FAILED')
    })

    it('atualiza pedido para CANCELLED em charge.refunded', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null)
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'order-xyz-456', status: 'CONFIRMED', paymentStatus: 'PAID' })
      mockPrisma.order.update.mockResolvedValue({ id: 'order-xyz-456', status: 'CANCELLED', paymentStatus: 'REFUNDED' })

      const result = await service.processEvent({ ...basePayload, event: 'charge.refunded' })

      expect(result.newStatus).toBe('CANCELLED')
      expect(result.newPaymentStatus).toBe('REFUNDED')
    })

    it('ignora evento sem mapeamento (charge.pending)', async () => {
      const result = await service.processEvent({ ...basePayload, event: 'charge.pending' })

      expect(result).toEqual({ processed: false, reason: 'no_mapping_or_order_id' })
      expect(mockPrisma.order.update).not.toHaveBeenCalled()
    })

    it('ignora payload sem orderId', async () => {
      const result = await service.processEvent({ ...basePayload, orderId: undefined })

      expect(result.processed).toBe(false)
      expect(result.reason).toBe('no_mapping_or_order_id')
    })

    it('resolve orderId a partir de metadata quando não está no top-level', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null)
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'meta-order-789', status: 'PENDING', paymentStatus: 'UNPAID' })
      mockPrisma.order.update.mockResolvedValue({ id: 'meta-order-789', status: 'CONFIRMED', paymentStatus: 'PAID' })

      const result = await service.processEvent({
        event: 'charge.paid',
        chargeId: 'charge-meta',
        status: 'paid',
        metadata: { orderId: 'meta-order-789' },
      })

      expect(result.orderId).toBe('meta-order-789')
      expect(result.processed).toBe(true)
    })

    it('retorna processed=false quando pedido não existe no banco', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null)
      mockPrisma.order.findUnique.mockResolvedValue(null)

      const result = await service.processEvent(basePayload)

      expect(result).toEqual({ processed: false, reason: 'order_not_found', orderId: 'order-xyz-456' })
      expect(mockPrisma.order.update).not.toHaveBeenCalled()
    })

    it('ignora evento duplicado (idempotência) sem atualizar pedido', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'order-xyz-456', status: 'PENDING', paymentStatus: 'UNPAID' })
      mockPaymentsLedger.recordEvent.mockResolvedValueOnce({ event: { id: 'event-1' }, duplicate: true })

      const result = await service.processEvent(basePayload)

      expect(result).toEqual({ processed: false, reason: 'duplicate', orderId: 'order-xyz-456' })
      expect(mockPrisma.order.update).not.toHaveBeenCalled()
      expect(mockPaymentsLedger.updateTransactionStatus).not.toHaveBeenCalled()
    })

    it('registra PAYMENT_WEBHOOK_RECEIVED no auditLog em qualquer evento', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null)
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'order-xyz-456', status: 'PENDING', paymentStatus: 'UNPAID' })
      mockPrisma.order.update.mockResolvedValue({})

      await service.processEvent(basePayload)

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'PAYMENT_WEBHOOK_RECEIVED', entityId: 'charge-abc-123' }),
        }),
      )
    })

    it('registra PAYMENT_STATUS_UPDATED com previousStatus e newStatus', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null)
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'order-xyz-456', status: 'PENDING', paymentStatus: 'UNPAID' })
      mockPrisma.order.update.mockResolvedValue({})

      await service.processEvent(basePayload)

      const secondCall = mockPrisma.auditLog.create.mock.calls[1]
      const changes = JSON.parse(secondCall[0].data.changes)
      expect(changes.previousStatus).toBe('PENDING')
      expect(changes.newStatus).toBe('CONFIRMED')
      expect(changes.previousPaymentStatus).toBe('UNPAID')
      expect(changes.newPaymentStatus).toBe('PAID')
      expect(changes.chargeId).toBe('charge-abc-123')
    })
  })

  // ── listRecentEvents ────────────────────────────────────────────────────────

  describe('listRecentEvents', () => {
    it('retorna lista mapeada com campos esperados', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          entityId: 'charge-001',
          action: 'PAYMENT_WEBHOOK_RECEIVED',
          createdAt: new Date('2026-04-19T12:00:00.000Z'),
          changes: JSON.stringify({
            event: 'charge.paid',
            orderId: 'order-001',
            status: 'paid',
            amount: 5000,
            paidAt: '2026-04-19T12:00:00Z',
            mappedStatus: 'CONFIRMED',
          }),
        },
      ])

      const result = await service.listRecentEvents(10)

      expect(result.total).toBe(1)
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          chargeId: 'charge-001',
          event: 'charge.paid',
          orderId: 'order-001',
          mappedStatus: 'CONFIRMED',
          amount: 5000,
        }),
      )
    })

    it('limita o take a 100', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])

      await service.listRecentEvents(999)

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      )
    })

    it('limita o take a 1 no mínimo', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])

      await service.listRecentEvents(0)

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }),
      )
    })
  })
})
