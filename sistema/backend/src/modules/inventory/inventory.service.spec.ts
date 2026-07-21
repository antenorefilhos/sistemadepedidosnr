import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { PublicApiService } from '../public-api/public-api.service'
import { InventoryService } from './inventory.service'

const mockPrismaService: any = {
  stockPosition: {
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
  },
  stockReservation: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  stockLedger: {
    create: jest.fn(),
  },
  stockPolicy: {
    findFirst: jest.fn(),
  },
  stockReconciliationRun: {
    create: jest.fn(),
  },
  orderItem: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  order: {
    update: jest.fn(),
  },
  analyticsEvent: {
    create: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn((cb: any) => cb(mockPrismaService)),
  $executeRaw: jest.fn(),
}

const mockPublicApiService = {
  emitWebhookEvent: jest.fn().mockResolvedValue({ deliveries: [] }),
}

describe('InventoryService', () => {
  let service: InventoryService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PublicApiService, useValue: mockPublicApiService },
      ],
    }).compile()

    service = module.get<InventoryService>(InventoryService)
    mockPrismaService.stockPosition.findMany.mockResolvedValue([{ productId: 'prod-1' }])
    mockPrismaService.stockPolicy.findFirst.mockResolvedValue(null)
    mockPrismaService.stockPosition.updateMany.mockResolvedValue({ count: 1 })
    mockPrismaService.stockPosition.findUniqueOrThrow.mockResolvedValue({
      productId: 'prod-1',
      onHand: new Prisma.Decimal('1'),
      reserved: new Prisma.Decimal('1'),
      available: new Prisma.Decimal('0'),
      safetyStock: new Prisma.Decimal('0'),
      source: 'RESERVATION',
      updatedAt: new Date(),
    })
    mockPrismaService.stockReservation.create.mockResolvedValue({
      id: 'res-1',
      productId: 'prod-1',
      quantity: new Prisma.Decimal('1'),
      status: 'ACTIVE',
    })
    mockPrismaService.stockLedger.create.mockResolvedValue({ id: 'ledger-1' })
    mockPrismaService.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      orderId: 'order-1',
      productId: 'prod-1',
      quantity: 2,
      unitPrice: 10,
      subtotal: 20,
      order: { id: 'order-1', subtotal: 20, total: 25, notes: null },
    })
    mockPrismaService.orderItem.update.mockResolvedValue({ id: 'item-1', quantity: 1, subtotal: 10 })
    mockPrismaService.order.update.mockResolvedValue({ id: 'order-1', subtotal: 10, total: 15 })
    mockPrismaService.stockPosition.update.mockResolvedValue({})
    mockPrismaService.stockReservation.findMany.mockResolvedValue([])
    mockPrismaService.stockReservation.update.mockResolvedValue({})
    mockPrismaService.analyticsEvent.create.mockResolvedValue({ id: 'event-1' })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should reserve stock with an atomic available decrement', async () => {
    const result = await service.reserveForCheckout({
      tenantId: 'tenant_default',
      storeId: 'store_default',
      orderId: 'order-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
    })

    expect(mockPrismaService.stockPosition.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productId: 'prod-1',
          available: { gte: expect.any(Prisma.Decimal) },
        }),
        data: expect.objectContaining({
          reserved: { increment: expect.any(Prisma.Decimal) },
          available: { decrement: expect.any(Prisma.Decimal) },
        }),
      }),
    )
    expect(mockPrismaService.stockReservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: 'order-1', productId: 'prod-1', status: 'ACTIVE' }),
      }),
    )
    expect(result).toHaveLength(1)
  })

  it('should reject the second checkout when the last item is already reserved', async () => {
    mockPrismaService.stockPosition.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      service.reserveForCheckout({
        tenantId: 'tenant_default',
        storeId: 'store_default',
        orderId: 'order-2',
        items: [{ productId: 'prod-1', quantity: 1 }],
      }),
    ).rejects.toThrow(BadRequestException)
    expect(mockPrismaService.stockReservation.create).not.toHaveBeenCalled()
  })

  it('should release expired reservations back to availability', async () => {
    mockPrismaService.stockReservation.findMany
      .mockResolvedValueOnce([{ id: 'res-1' }])
      .mockResolvedValueOnce([
        {
          id: 'res-1',
          tenantId: 'tenant_default',
          storeId: 'store_default',
          productId: 'prod-1',
          quantity: new Prisma.Decimal('1'),
        },
      ])
    mockPrismaService.stockReservation.update.mockResolvedValue({ id: 'res-1', status: 'EXPIRED' })
    mockPrismaService.stockPosition.update.mockResolvedValue({})
    mockPrismaService.stockPosition.findUniqueOrThrow.mockResolvedValue({
      productId: 'prod-1',
      onHand: new Prisma.Decimal('1'),
      reserved: new Prisma.Decimal('0'),
      available: new Prisma.Decimal('1'),
      safetyStock: new Prisma.Decimal('0'),
      source: 'EXPIRED',
      updatedAt: new Date(),
    })

    const result = await service.expireReservations(new Date())

    expect(mockPrismaService.stockPosition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reserved: { decrement: expect.any(Prisma.Decimal) },
          available: { increment: expect.any(Prisma.Decimal) },
        }),
      }),
    )
    expect(result).toEqual({ expired: 1 })
  })

  it('should require a reason for manual adjustment', async () => {
    await expect(
      service.createManualAdjustment(
        { tenantId: 'tenant_default', storeId: 'store_default' },
        { productId: 'prod-1', quantity: 1, reason: '' },
      ),
    ).rejects.toThrow('Motivo')
  })

  it('should record picking rupture in order, stock ledger and BI event', async () => {
    mockPrismaService.stockPosition.findUniqueOrThrow
      .mockResolvedValueOnce({
        productId: 'prod-1',
        onHand: new Prisma.Decimal('2'),
        reserved: new Prisma.Decimal('2'),
        available: new Prisma.Decimal('0'),
        safetyStock: new Prisma.Decimal('0'),
        source: 'RESERVATION',
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        productId: 'prod-1',
        onHand: new Prisma.Decimal('1'),
        reserved: new Prisma.Decimal('1'),
        available: new Prisma.Decimal('0'),
        safetyStock: new Prisma.Decimal('0'),
        source: 'PICK_ADJUST',
        updatedAt: new Date(),
      })

    const result = await service.recordPickingRupture(
      { tenantId: 'tenant_default', storeId: 'store_default' },
      { orderId: 'order-1', productId: 'prod-1', missingQuantity: 1, reason: 'Produto nao localizado' },
      'admin-1',
    )

    expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 1, subtotal: 10 }),
      }),
    )
    expect(mockPrismaService.stockLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'PICK_ADJUST', referenceId: 'order-1' }),
      }),
    )
    expect(mockPrismaService.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'RUPTURE', entityId: 'prod-1' }),
      }),
    )
    expect(result.adjustedQuantity).toBe(1)
  })
})
