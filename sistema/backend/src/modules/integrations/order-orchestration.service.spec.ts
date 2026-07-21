import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../common/prisma.service'
import { InternalOrderContract } from './dto/order-contract.dto'
import { OrderOrchestrationService } from './order-orchestration.service'
import { SolidcomERPService } from './solidcom-erp.service'
import { IntegrationModulesService } from './integration-modules.service'
import { IntegrationOutboxService } from './integration-outbox.service'

const mockSolidcomERPService = {
  syncOrder: jest.fn(),
  cancelOrder: jest.fn(),
  getOrder: jest.fn(),
  getOrdersByPeriod: jest.fn(),
}

const mockPrismaService = {
  auditLog: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
  },
}
const mockIntegrationModulesService = {
  isEnabled: jest.fn().mockResolvedValue(true),
}
const mockIntegrationOutboxService = {
  enqueueEvent: jest.fn(),
  enqueueSolidcomOrderFailure: jest.fn(),
}

describe('OrderOrchestrationService', () => {
  let service: OrderOrchestrationService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderOrchestrationService,
        { provide: SolidcomERPService, useValue: mockSolidcomERPService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IntegrationModulesService, useValue: mockIntegrationModulesService },
        { provide: IntegrationOutboxService, useValue: mockIntegrationOutboxService },
      ],
    }).compile()

    service = module.get<OrderOrchestrationService>(OrderOrchestrationService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('deve mapear etiqueta de balanca para quantidade/cdProduto e enviar ao ERP', async () => {
    const payload: InternalOrderContract = {
      orderId: 'order-12345678',
      customerId: 'cust-1',
      status: 'PENDING',
      paymentMethod: 'PIX',
      paymentStatus: 'PENDING',
      subtotal: 24.93,
      delivery: 0,
      discount: 0,
      total: 24.93,
      notes: null,
      customer: {
        id: 'cust-1',
        cpf: '23715771704',
        name: 'BALCAO',
        whatsapp: '5511999999999',
        email: null,
      },
      items: [
        {
          productId: 'prod-516',
          productName: 'Produto fracionado',
          ean: '1896',
          quantity: 1,
          unitPrice: 24.9,
          subtotal: 24.93,
          scannedCode: '2000516024932',
        },
      ],
    }

    mockSolidcomERPService.syncOrder.mockResolvedValue(undefined)
    mockPrismaService.auditLog.create.mockResolvedValue({ id: 'log-1' })

    await service.syncCreatedOrder(payload)

    expect(mockSolidcomERPService.syncOrder).toHaveBeenCalledWith(
      'order-12345678',
      expect.objectContaining({
        codEcom: 19,
        dav: 0,
        itens: [
          expect.objectContaining({
            cdProduto: 516,
            quantidade: 1.001,
            valorUnitario: 24.9,
          }),
        ],
      }),
    )
    expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'INTERNAL_ORDER_CONTRACT_SNAPSHOT',
          entity: 'ORDER_SYNC_SOLIDCOM',
          entityId: 'order-12345678',
        }),
      }),
    )
  })

  it('deve enviar pedido de retirada ao ERP com retiraNaLoja ativo', async () => {
    const payload: InternalOrderContract = {
      orderId: 'order-pickup',
      customerId: 'cust-1',
      fulfillmentType: 'PICKUP',
      status: 'READY_FOR_PICKUP',
      paymentMethod: 'PIX',
      paymentStatus: 'PAID',
      subtotal: 30,
      delivery: 0,
      discount: 0,
      total: 30,
      notes: null,
      customer: {
        id: 'cust-1',
        cpf: '23715771704',
        name: 'Cliente Retirada',
        whatsapp: '5511999999999',
        email: null,
      },
      items: [],
    }

    mockSolidcomERPService.syncOrder.mockResolvedValue(undefined)
    mockPrismaService.auditLog.create.mockResolvedValue({ id: 'log-1' })

    await service.syncCreatedOrder(payload)

    expect(mockSolidcomERPService.syncOrder).toHaveBeenCalledWith(
      'order-pickup',
      expect.objectContaining({
        retiraNaLoja: true,
        valorFrete: 0,
      }),
    )
  })

  it('deve reprocessar pedido usando payload salvo em falha anterior', async () => {
    mockPrismaService.auditLog.findFirst.mockResolvedValue({
      id: 'log-failed',
      changes: JSON.stringify({
        payload: {
          cnpj: 5147995000131,
          numero: 1234567890,
          data: new Date().toISOString(),
          codEcom: 19,
          dav: 0,
          valorFrete: 0,
          valorDesconto: 0,
          retiraNaLoja: false,
          ecommerceSolidcon: true,
          ecommerceSolidconStatus: 1,
          referencia: 'PDV-1234567890',
          itens: [],
          cliente: { cpf: 23715771704, nome: 'BALCAO' },
        },
      }),
    })

    mockSolidcomERPService.syncOrder.mockResolvedValue(undefined)
    mockPrismaService.auditLog.create.mockResolvedValue({ id: 'log-success' })

    const result = await service.retryOrderSync('order-12345678')

    expect(result).toEqual({ orderId: 'order-12345678', retried: true, success: true })
    expect(mockSolidcomERPService.syncOrder).toHaveBeenCalledWith(
      'order-12345678',
      expect.objectContaining({ codEcom: 19 }),
    )
  })

  it('deve retornar contrato interno normalizado e preview ERP de um pedido existente', async () => {
    mockPrismaService.auditLog.findFirst.mockResolvedValueOnce(null)
    mockPrismaService.order.findUnique.mockResolvedValue({
      id: 'order-12345678',
      customerId: 'cust-1',
      status: 'PENDING',
      paymentMethod: 'PIX',
      subtotal: 24.93,
      delivery: 0,
      discount: 0,
      total: 24.93,
      notes: 'Entregar rapido',
      customer: {
        id: 'cust-1',
        cpf: '23715771704',
        name: 'Cliente Teste',
        whatsapp: '5511999999999',
        email: 'cliente@teste.com',
      },
      items: [
        {
          productId: 'prod-516',
          quantity: 1,
          unitPrice: 24.93,
          subtotal: 24.93,
          product: {
            name: 'Produto fracionado',
            ean: '1896',
          },
        },
      ],
    })

    const result = await service.getOrderContract('order-12345678')

    expect(result).toEqual(
      expect.objectContaining({
        found: true,
        orderId: 'order-12345678',
        contract: expect.objectContaining({
          orderId: 'order-12345678',
          customerId: 'cust-1',
          items: [
            expect.objectContaining({
              productId: 'prod-516',
              productName: 'Produto fracionado',
              ean: '1896',
            }),
          ],
        }),
        externalPreview: expect.objectContaining({
          codEcom: 19,
          itens: [expect.objectContaining({ nmProduto: 'Produto fracionado' })],
        }),
      }),
    )
  })

  it('deve preferir snapshot historico do contrato ao consultar introspecao do pedido', async () => {
    mockPrismaService.auditLog.findFirst.mockResolvedValue({
      id: 'snapshot-1',
      changes: JSON.stringify({
        contract: {
          orderId: 'order-999',
          customerId: 'cust-9',
          status: 'PENDING',
          paymentMethod: 'PIX',
          subtotal: 15,
          delivery: 5,
          discount: 0,
          total: 20,
          notes: 'snapshot',
          customer: {
            id: 'cust-9',
            cpf: '12345678900',
            name: 'Cliente Snapshot',
            whatsapp: '5511888888888',
            email: null,
          },
          items: [
            {
              productId: 'prod-1',
              productName: 'Produto Snapshot',
              ean: '100',
              quantity: 2,
              unitPrice: 7.5,
              subtotal: 15,
              scannedCode: null,
            },
          ],
        },
        externalPreview: {
          cnpj: 5147995000131,
          numero: 999,
          data: new Date().toISOString(),
          codEcom: 19,
          dav: 0,
          valorFrete: 5,
          valorDesconto: 0,
          retiraNaLoja: false,
          ecommerceSolidcon: true,
          ecommerceSolidconStatus: 1,
          referencia: 'PDV-999',
          cliente: { cpf: 12345678900, nome: 'Cliente Snapshot' },
          itens: [],
        },
      }),
    })

    const result = await service.getOrderContract('order-999')

    expect(result).toEqual(
      expect.objectContaining({
        found: true,
        orderId: 'order-999',
        source: 'snapshot',
        contract: expect.objectContaining({
          customerId: 'cust-9',
          notes: 'snapshot',
        }),
        externalPreview: expect.objectContaining({
          codEcom: 19,
          valorFrete: 5,
        }),
      }),
    )
    expect(mockPrismaService.order.findUnique).not.toHaveBeenCalled()
  })

  it('deve listar snapshots historicos do contrato por pedido', async () => {
    mockPrismaService.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        action: 'INTERNAL_ORDER_CONTRACT_SNAPSHOT',
        createdAt: new Date('2026-04-19T10:00:00.000Z'),
        changes: JSON.stringify({
          contract: {
            orderId: 'order-1',
            customerId: 'cust-1',
            status: 'PENDING',
            paymentMethod: 'PIX',
            subtotal: 10,
            delivery: 0,
            discount: 0,
            total: 10,
            notes: null,
            customer: { id: 'cust-1', cpf: null, name: 'Cliente', whatsapp: '5511', email: null },
            items: [],
          },
          externalPreview: { numero: 123, codEcom: 19 },
        }),
      },
    ])

    const result = await service.listOrderContractSnapshots('order-1', 10)

    expect(result.total).toBe(1)
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        action: 'INTERNAL_ORDER_CONTRACT_SNAPSHOT',
        externalOrderNumber: 123,
      }),
    )
  })

  it('deve sincronizar cancelamento usando numero externo do snapshot historico', async () => {
    mockPrismaService.auditLog.findFirst.mockResolvedValue({
      id: 'snapshot-order',
      changes: JSON.stringify({
        externalPreview: {
          numero: 456789,
        },
      }),
    })
    mockSolidcomERPService.cancelOrder.mockResolvedValue(undefined)
    mockPrismaService.auditLog.create.mockResolvedValue({ id: 'log-cancel' })

    await service.syncCancelledOrder(
      {
        orderId: 'order-cancel',
        customerId: 'cust-1',
        status: 'CANCELLED',
        paymentMethod: 'PIX',
        paymentStatus: 'PENDING',
        subtotal: 10,
        delivery: 0,
        discount: 0,
        total: 10,
        notes: null,
        customer: { id: 'cust-1', cpf: null, name: 'Cliente', whatsapp: '5511', email: null },
        items: [],
      },
      'Cliente desistiu',
    )

    expect(mockSolidcomERPService.cancelOrder).toHaveBeenCalledWith(456789, 'Cliente desistiu')
    expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'INTERNAL_ORDER_CANCELLATION_SNAPSHOT',
          entityId: 'order-cancel',
        }),
      }),
    )
  })

  it('deve consultar pedido remoto no ERP a partir do numero externo do snapshot', async () => {
    mockPrismaService.auditLog.findFirst.mockResolvedValue({
      id: 'snapshot-order',
      changes: JSON.stringify({
        externalPreview: {
          numero: 654321,
        },
      }),
    })
    mockSolidcomERPService.getOrder.mockResolvedValue({ numero: 654321, status: 'PROCESSING' })

    const result = await service.getRemoteOrder('order-remote')

    expect(mockSolidcomERPService.getOrder).toHaveBeenCalledWith(654321)
    expect(result).toEqual({
      found: true,
      orderId: 'order-remote',
      externalOrderNumber: 654321,
      remoteOrder: { numero: 654321, status: 'PROCESSING' },
    })
  })

  it('deve reconciliar pedidos por periodo cruzando ERP com snapshots internos', async () => {
    mockSolidcomERPService.getOrdersByPeriod.mockResolvedValue([
      { numero: 111, status: 'OK' },
      { numero: 999, status: 'OK' },
    ])

    mockPrismaService.auditLog.findMany.mockResolvedValue([
      {
        id: 'snap-1',
        entityId: 'order-aaa',
        createdAt: new Date('2026-04-18T10:00:00Z'),
        changes: JSON.stringify({ externalPreview: { numero: 111 } }),
      },
      {
        id: 'snap-2',
        entityId: 'order-bbb',
        createdAt: new Date('2026-04-18T11:00:00Z'),
        changes: JSON.stringify({ externalPreview: { numero: 777 } }),
      },
    ])

    const result = await service.reconcileOrdersByPeriod('2026-04-18', '2026-04-19')

    expect(result.summary.matched).toBe(1)
    expect(result.summary.localOnly).toBe(1)
    expect(result.summary.remoteOnly).toBe(1)
    expect(result.summary.total).toBe(3)

    const matched = result.items.find((i) => i.status === 'matched')
    expect(matched?.orderId).toBe('order-aaa')
    expect(matched?.externalOrderNumber).toBe(111)

    const localOnly = result.items.find((i) => i.status === 'local_only')
    expect(localOnly?.orderId).toBe('order-bbb')

    const remoteOnly = result.items.find((i) => i.status === 'remote_only')
    expect(remoteOnly?.externalOrderNumber).toBe(999)
  })
})
