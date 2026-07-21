import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../common/prisma.service'
import { IntegrationsService } from './integrations.service'
import { HubSpotService } from './hubspot.service'
import { NfeService } from './nfe.service'
import { PaymentsService } from './payments.service'
import { PaymentsWebhookService } from './payments-webhook.service'
import { PaymentsLedgerService } from './payments-ledger.service'
import { IntegrationModulesService } from './integration-modules.service'
import { IntegrationOutboxService } from './integration-outbox.service'

const mockPrismaService = {
  product: {
    count: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  customer: {
    findUnique: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
  },
}

const mockHubSpotService = { syncCustomer: jest.fn(), getHealth: jest.fn() }
const mockNfeService = { emitNfe: jest.fn(), getHealth: jest.fn() }
const mockPaymentsService = { createCharge: jest.fn(), getHealth: jest.fn(), gerarCobranca: jest.fn() }
const mockPaymentsWebhookService = { processEvent: jest.fn() }
const mockPaymentsLedgerService = {
  listTransactions: jest.fn(),
  createTransactionForOrder: jest.fn(),
  createRefund: jest.fn(),
  registerChargeback: jest.fn(),
  reconcile: jest.fn(),
}
const mockIntegrationOutboxService = {
  createConnector: jest.fn(),
  listConnectors: jest.fn(),
  enqueueEvent: jest.fn(),
  listOutboxEvents: jest.fn(),
  replayOutboxEvent: jest.fn(),
  runDueOutboxBatch: jest.fn(),
  listJobs: jest.fn(),
  listDeadLetters: jest.fn(),
  replayDeadLetter: jest.fn(),
  getPanel: jest.fn(),
}
const mockIntegrationModulesService = {
  list: jest.fn().mockResolvedValue([]),
  setEnabled: jest.fn(),
  isEnabled: jest.fn().mockResolvedValue(true),
}

describe('IntegrationsService', () => {
  let service: IntegrationsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: HubSpotService, useValue: mockHubSpotService },
        { provide: NfeService, useValue: mockNfeService },
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: PaymentsWebhookService, useValue: mockPaymentsWebhookService },
        { provide: PaymentsLedgerService, useValue: mockPaymentsLedgerService },
        { provide: IntegrationOutboxService, useValue: mockIntegrationOutboxService },
        { provide: IntegrationModulesService, useValue: mockIntegrationModulesService },
      ],
    }).compile()

    service = module.get<IntegrationsService>(IntegrationsService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('deve listar falhas de sync de pedidos', async () => {
    mockPrismaService.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        entityId: 'order-1',
        action: 'SYNC_ORDER_FAILED',
        createdAt: new Date('2026-04-19T10:00:00.000Z'),
        changes: JSON.stringify({ reason: 'timeout' }),
      },
    ])

    const result = await service.listOrderSyncFailures(10)

    expect(result.total).toBe(1)
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        orderId: 'order-1',
        action: 'SYNC_ORDER_FAILED',
      }),
    )
  })

  it('deve retornar found=false quando nao houver falha para o pedido', async () => {
    mockPrismaService.auditLog.findFirst.mockResolvedValue(null)

    const result = await service.getOrderSyncFailure('order-x')

    expect(result).toEqual({ found: false, orderId: 'order-x' })
  })

  it('deve retornar health real do conector de pagamentos a partir da configuracao atual', async () => {
    const originalProvider = process.env.PAYMENTS_PROVIDER_NAME
    const originalUrl = process.env.PAYMENTS_PROVIDER_URL
    const originalWebhook = process.env.PAYMENTS_WEBHOOK_SECRET
    const originalPixKey = process.env.PIX_KEY

    process.env.PAYMENTS_PROVIDER_NAME = 'Gateway Teste'
    process.env.PAYMENTS_PROVIDER_URL = 'https://payments.example.com'
    process.env.PAYMENTS_WEBHOOK_SECRET = ''
    process.env.PIX_KEY = ''

    const result = await service.getPaymentsHealth()

    expect(result).toEqual(
      expect.objectContaining({
        integration: 'payments',
        status: 'partial',
        provider: 'Gateway Teste',
        checks: expect.objectContaining({
          providerName: true,
          providerUrl: true,
          webhookSecret: false,
          pixKey: false,
          manualPixFallback: true,
        }),
      }),
    )

    process.env.PAYMENTS_PROVIDER_NAME = originalProvider
    process.env.PAYMENTS_PROVIDER_URL = originalUrl
    process.env.PAYMENTS_WEBHOOK_SECRET = originalWebhook
    process.env.PIX_KEY = originalPixKey
  })

  it('deve retornar health real do conector CRM com status partial quando apenas apiKey configurado', async () => {
    const originalApiKey = process.env.HUBSPOT_API_KEY
    const originalPortalId = process.env.HUBSPOT_PORTAL_ID
    const originalOwner = process.env.HUBSPOT_DEFAULT_OWNER_ID

    process.env.HUBSPOT_API_KEY = 'pat-na1-xxx'
    process.env.HUBSPOT_PORTAL_ID = ''
    process.env.HUBSPOT_DEFAULT_OWNER_ID = ''

    const result = await service.getCrmHealth()

    expect(result).toEqual(
      expect.objectContaining({
        integration: 'crm',
        provider: 'HubSpot',
        status: 'partial',
        configured: true,
        checks: expect.objectContaining({
          apiKey: true,
          portalId: false,
          defaultOwner: false,
        }),
      }),
    )

    process.env.HUBSPOT_API_KEY = originalApiKey
    process.env.HUBSPOT_PORTAL_ID = originalPortalId
    process.env.HUBSPOT_DEFAULT_OWNER_ID = originalOwner
  })

  it('deve retornar health real do conector Fiscal com status not_configured quando nenhuma env definida', async () => {
    const originals: Record<string, string | undefined> = {}
    const keys = ['NFE_PROVIDER_NAME', 'NFE_PROVIDER_URL', 'NFE_API_KEY', 'NFE_CNPJ_EMITENTE', 'NFE_CERT_PATH']
    keys.forEach((k) => {
      originals[k] = process.env[k]
      delete process.env[k]
    })

    const result = await service.getFiscalHealth()

    expect(result).toEqual(
      expect.objectContaining({
        integration: 'fiscal',
        status: 'not_configured',
        configured: false,
        checks: expect.objectContaining({
          providerName: false,
          providerUrl: false,
          apiKey: false,
          cnpjEmitente: false,
          certPath: false,
        }),
      }),
    )

    keys.forEach((k) => {
      if (originals[k] !== undefined) process.env[k] = originals[k]
    })
  })

  it('deve construir preview do contrato CRM a partir de cliente existente', async () => {
    mockPrismaService.customer.findUnique.mockResolvedValue({
      id: 'cust-1',
      name: 'João Silva',
      cpf: '12345678900',
      whatsapp: '11999999999',
      email: 'joao@example.com',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })

    const result = await service.buildCrmContactPreview('cust-1')

    expect(result.found).toBe(true)
    expect(result.contract).toEqual(
      expect.objectContaining({
        customerId: 'cust-1',
        firstName: 'João',
        lastName: 'Silva',
        lifecycleStage: 'customer',
        eventType: 'customer_registered',
        properties: expect.objectContaining({ lifecyclestage: 'customer' }),
      }),
    )
    expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'INTERNAL_CRM_CONTACT_SNAPSHOT',
          entity: 'CRM_CONTACT_HUBSPOT',
          entityId: 'cust-1',
        }),
      }),
    )
  })

  it('deve retornar found=false para preview CRM quando cliente nao existe', async () => {
    mockPrismaService.customer.findUnique.mockResolvedValue(null)

    const result = await service.buildCrmContactPreview('nao-existe')

    expect(result).toEqual({ found: false, customerId: 'nao-existe' })
  })

  it('deve construir preview do contrato fiscal a partir de pedido existente', async () => {
    mockPrismaService.order.findUnique.mockResolvedValue({
      id: 'order-1',
      subtotal: 50,
      discount: 0,
      delivery: 5,
      total: 55,
      notes: null,
      paymentMethod: 'PIX',
      customer: { name: 'Maria', cpf: '98765432100' },
      items: [
        {
          productId: 'prod-1',
          quantity: 2,
          unitPrice: 25,
          subtotal: 50,
          product: { ean: '7891234567890', name: 'Produto A', unit: 'UN' },
        },
      ],
    })

    const result = await service.buildFiscalDocumentPreview('order-1')

    expect(result.found).toBe(true)
    expect(result.contract).toEqual(
      expect.objectContaining({
        orderId: 'order-1',
        naturezaOperacao: 'VENDA AO CONSUMIDOR FINAL',
        destinatarioNome: 'Maria',
        valorTotal: 55,
        itens: expect.arrayContaining([
          expect.objectContaining({ ean: '7891234567890', cfop: '5102' }),
        ]),
      }),
    )
    expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'INTERNAL_FISCAL_DOCUMENT_SNAPSHOT',
          entity: 'FISCAL_DOCUMENT_NFE',
          entityId: 'order-1',
        }),
      }),
    )
  })

  it('deve construir preview do contrato de cobranca a partir de pedido existente', async () => {
    mockPrismaService.order.findUnique.mockResolvedValue({
      id: 'order-2',
      customerId: 'cust-2',
      total: 120,
      paymentMethod: 'PIX',
      customer: { name: 'Carlos', whatsapp: '11988888888' },
    })
    delete process.env.PIX_KEY

    const result = await service.buildChargePreview('order-2')

    expect(result.found).toBe(true)
    expect(result.contract).toEqual(
      expect.objectContaining({
        orderId: 'order-2',
        amount: 120,
        method: 'PIX',
        pixKey: null,
        expiresInSeconds: 3600,
        metadata: expect.objectContaining({ paymentMethod: 'PIX' }),
      }),
    )
    expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'INTERNAL_CHARGE_CONTRACT_SNAPSHOT',
          entity: 'PAYMENT_CHARGE',
          entityId: 'order-2',
        }),
      }),
    )
  })

  it('deve listar snapshots CRM por customerId', async () => {
    mockPrismaService.auditLog.findMany.mockResolvedValue([
      {
        id: 'crm-log-1',
        action: 'INTERNAL_CRM_CONTACT_SNAPSHOT',
        entityId: 'cust-1',
        createdAt: new Date('2026-04-19T10:00:00.000Z'),
        changes: JSON.stringify({ contract: { customerId: 'cust-1', firstName: 'Joao' } }),
      },
    ])

    const result = await service.listCrmContactSnapshots('cust-1', 8)

    expect(result).toEqual(
      expect.objectContaining({
        customerId: 'cust-1',
        total: 1,
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'crm-log-1',
            action: 'INTERNAL_CRM_CONTACT_SNAPSHOT',
            contract: expect.objectContaining({ customerId: 'cust-1' }),
          }),
        ]),
      }),
    )
  })

  it('deve listar snapshots fiscais por orderId', async () => {
    mockPrismaService.auditLog.findMany.mockResolvedValue([
      {
        id: 'fiscal-log-1',
        action: 'INTERNAL_FISCAL_DOCUMENT_SNAPSHOT',
        entityId: 'order-1',
        createdAt: new Date('2026-04-19T10:00:00.000Z'),
        changes: JSON.stringify({ contract: { orderId: 'order-1', valorTotal: 55 } }),
      },
    ])

    const result = await service.listFiscalDocumentSnapshots('order-1', 8)

    expect(result).toEqual(
      expect.objectContaining({
        orderId: 'order-1',
        total: 1,
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'fiscal-log-1',
            action: 'INTERNAL_FISCAL_DOCUMENT_SNAPSHOT',
            contract: expect.objectContaining({ orderId: 'order-1' }),
          }),
        ]),
      }),
    )
  })

  it('deve listar snapshots de cobranca por orderId', async () => {
    mockPrismaService.auditLog.findMany.mockResolvedValue([
      {
        id: 'charge-log-1',
        action: 'INTERNAL_CHARGE_CONTRACT_SNAPSHOT',
        entityId: 'order-2',
        createdAt: new Date('2026-04-19T10:00:00.000Z'),
        changes: JSON.stringify({ contract: { orderId: 'order-2', amount: 120 } }),
      },
    ])

    const result = await service.listChargeSnapshots('order-2', 8)

    expect(result).toEqual(
      expect.objectContaining({
        orderId: 'order-2',
        total: 1,
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'charge-log-1',
            action: 'INTERNAL_CHARGE_CONTRACT_SNAPSHOT',
            contract: expect.objectContaining({ orderId: 'order-2' }),
          }),
        ]),
      }),
    )
  })
})
