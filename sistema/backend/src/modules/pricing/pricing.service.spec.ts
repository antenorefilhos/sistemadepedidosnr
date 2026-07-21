import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { PricingService, PromotionEngineService } from './pricing.service'

const now = new Date()
const future = new Date(Date.now() + 60_000)

const mockPrismaService: any = {
  product: { findMany: jest.fn() },
  priceList: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  priceListItem: { findMany: jest.fn(), upsert: jest.fn() },
  promotion: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  coupon: { findFirst: jest.fn() },
  promotionUsage: { count: jest.fn(), createMany: jest.fn() },
  priceAuditLog: { create: jest.fn() },
}

describe('PricingService', () => {
  let service: PricingService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        PromotionEngineService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile()

    service = module.get(PricingService)
    mockPrismaService.product.findMany.mockResolvedValue([
      {
        id: 'prod-1',
        ean: '789',
        name: 'Cafe',
        category: 'MERCEARIA',
        tenantId: 'tenant_default',
        storeId: 'store_default',
        price: 20,
        promotionalPrice: null,
        active: true,
        syncOption: 'ESTOQUE',
      },
    ])
    mockPrismaService.priceList.findMany.mockResolvedValue([{ id: 'pl-1' }])
    mockPrismaService.priceListItem.findMany.mockResolvedValue([
      {
        priceListId: 'pl-1',
        productId: 'prod-1',
        price: new Prisma.Decimal('18.00'),
        cost: new Prisma.Decimal('12.00'),
      },
    ])
    mockPrismaService.promotion.findMany.mockResolvedValue([])
    mockPrismaService.promotionUsage.count.mockResolvedValue(0)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should quote using active price list and estimated margin', async () => {
    const quote = await service.quote({
      tenantId: 'tenant_default',
      storeId: 'store_default',
      items: [{ productId: 'prod-1', quantity: 2 }],
      deliveryAmount: 5,
    })

    expect(quote.subtotal).toBe(36)
    expect(quote.total).toBe(41)
    expect(quote.items[0]).toEqual(expect.objectContaining({ unitPrice: 18, priceListId: 'pl-1', margin: 33.33 }))
  })

  it('should reject expired coupon promotions', async () => {
    mockPrismaService.coupon.findFirst.mockResolvedValue(null)

    await expect(
      service.quote({
        tenantId: 'tenant_default',
        storeId: 'store_default',
        couponCode: 'OLD10',
        items: [{ productId: 'prod-1', quantity: 1 }],
      }),
    ).rejects.toThrow('Cupom invalido')
  })

  it('should reject coupon above global usage limit', async () => {
    mockPrismaService.coupon.findFirst.mockResolvedValue({
      id: 'coupon-1',
      tenantId: 'tenant_default',
      code: 'SAVE10',
      maxUses: 1,
      maxUsesPerCustomer: null,
      promotion: {
        id: 'promo-1',
        tenantId: 'tenant_default',
        name: 'Save 10',
        type: 'COUPON',
        status: 'ACTIVE',
        priority: 10,
        stackable: false,
        startsAt: now,
        endsAt: future,
        rules: [{ condition: {}, effect: { type: 'PERCENT_OFF', percent: 10 } }],
        coupons: [{ id: 'coupon-1' }],
      },
    })
    mockPrismaService.promotionUsage.count.mockResolvedValue(1)

    await expect(
      service.quote({
        tenantId: 'tenant_default',
        storeId: 'store_default',
        couponCode: 'SAVE10',
        items: [{ productId: 'prod-1', quantity: 1 }],
      }),
    ).rejects.toThrow('limite global')
  })

  it('should resolve promotion conflict by priority', async () => {
    mockPrismaService.promotion.findMany.mockResolvedValue([
      {
        id: 'promo-low',
        tenantId: 'tenant_default',
        name: 'Low',
        type: 'AUTOMATIC',
        status: 'ACTIVE',
        priority: 1,
        stackable: false,
        startsAt: now,
        endsAt: future,
        rules: [{ condition: {}, effect: { type: 'FIXED_OFF', amount: 20 } }],
        coupons: [],
      },
      {
        id: 'promo-high',
        tenantId: 'tenant_default',
        name: 'High',
        type: 'AUTOMATIC',
        status: 'ACTIVE',
        priority: 10,
        stackable: false,
        startsAt: now,
        endsAt: future,
        rules: [{ condition: {}, effect: { type: 'FIXED_OFF', amount: 5 } }],
        coupons: [],
      },
    ])

    const quote = await service.quote({
      tenantId: 'tenant_default',
      storeId: 'store_default',
      items: [{ productId: 'prod-1', quantity: 2 }],
    })

    expect(quote.discountAmount).toBe(5)
    expect(quote.appliedPromotions).toHaveLength(1)
    expect(quote.appliedPromotions[0].promotionId).toBe('promo-high')
  })

  it('should record coupon usage after checkout succeeds', async () => {
    await service.recordPromotionUsage(
      {
        tenantId: 'tenant_default',
        appliedPromotions: [
          {
            promotionId: 'promo-1',
            couponId: 'coupon-1',
            name: 'Coupon',
            type: 'COUPON',
            priority: 1,
            stackable: false,
            discountAmount: 10,
            freeShipping: false,
          },
        ],
      },
      'order-1',
      'customer-1',
    )

    expect(mockPrismaService.promotionUsage.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            promotionId: 'promo-1',
            couponId: 'coupon-1',
            orderId: 'order-1',
            customerId: 'customer-1',
          }),
        ],
      }),
    )
  })

  it('should reject invalid quote item quantity', async () => {
    await expect(service.quote({ items: [{ productId: 'prod-1', quantity: 0 }] })).rejects.toThrow(BadRequestException)
  })
})
