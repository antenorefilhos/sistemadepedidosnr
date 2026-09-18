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
  coupon: { findFirst: jest.fn(), findUnique: jest.fn() },
  promotionUsage: { count: jest.fn(), createMany: jest.fn() },
  priceAuditLog: { create: jest.fn() },
  $transaction: jest.fn((cb: any) => cb(mockPrismaService)),
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
    ).rejects.toThrow('esgotou')
  })

  it('should validate a FREE_SHIPPING coupon as valid even with zero subtotal discount', async () => {
    // validateCoupon sempre cai no fallback (previewCouponDiscount): o
    // quote() interno usa um productId placeholder que nunca existe de
    // verdade, entao sempre lanca e cai no catch. Regressao real: sem o
    // flag freeShipping, um cupom FREE_SHIPPING sempre reportava
    // valid=false (discountAmount fica 0, o desconto e no frete, que essa
    // preview nem recebe) -- o cliente nunca conseguia aplicar no carrinho.
    mockPrismaService.coupon.findFirst.mockResolvedValue({
      id: 'coupon-frete',
      tenantId: 'tenant_default',
      code: 'FRETEGRATIS',
      maxUses: null,
      maxUsesPerCustomer: null,
      promotion: {
        id: 'promo-frete',
        tenantId: 'tenant_default',
        name: 'Frete gratis',
        type: 'FREE_SHIPPING',
        status: 'ACTIVE',
        priority: 10,
        stackable: false,
        startsAt: now,
        endsAt: future,
        rules: [{ condition: {}, effect: { type: 'FREE_SHIPPING' } }],
        coupons: [{ id: 'coupon-frete' }],
      },
    })

    const result = await service.validateCoupon('FRETEGRATIS', 50, { tenantId: 'tenant_default', storeId: 'store_default' })

    expect(result.valid).toBe(true)
    expect(result.discountAmount).toBe(0)
    expect(result.message).toContain('Frete grátis')
  })

  it('should return valid:false (not throw) when the coupon usage limit was already reached', async () => {
    // Achado testando em produção: previewCouponDiscount lanca
    // BadRequestException via assertCouponUsageLimit quando o limite bateu.
    // Sem tratar isso dentro de validateCoupon, o GET /coupons/validate
    // devolvia 400 cru -- e o "Aplicar" do carrinho (CartContext.applyCoupon)
    // nao tem try/catch, so le response.data.valid: o clique falhava calado.
    mockPrismaService.coupon.findFirst.mockResolvedValue({
      id: 'coupon-esgotado',
      tenantId: 'tenant_default',
      code: 'ESGOTADO',
      maxUses: 1,
      maxUsesPerCustomer: null,
      promotion: {
        id: 'promo-esgotado',
        tenantId: 'tenant_default',
        name: 'Esgotado',
        type: 'FIXED_OFF',
        status: 'ACTIVE',
        priority: 10,
        stackable: false,
        startsAt: now,
        endsAt: future,
        rules: [{ condition: {}, effect: { type: 'FIXED_OFF', amount: 15 } }],
        coupons: [{ id: 'coupon-esgotado' }],
      },
    })
    mockPrismaService.promotionUsage.count.mockResolvedValue(1)

    const result = await service.validateCoupon('ESGOTADO', 100, { tenantId: 'tenant_default', storeId: 'store_default' })

    expect(result.valid).toBe(false)
    expect(result.discountAmount).toBe(0)
    expect(result.message).toContain('esgotou')
  })

  it('should explain the exact missing amount when the coupon requires a higher minimum subtotal', async () => {
    mockPrismaService.coupon.findFirst.mockResolvedValue({
      id: 'coupon-min',
      tenantId: 'tenant_default',
      code: 'MINIMO50',
      maxUses: null,
      maxUsesPerCustomer: null,
      promotion: {
        id: 'promo-min',
        tenantId: 'tenant_default',
        name: 'Minimo 50',
        type: 'FIXED_OFF',
        status: 'ACTIVE',
        priority: 10,
        stackable: false,
        startsAt: now,
        endsAt: future,
        rules: [{ condition: { minSubtotal: 50 }, effect: { type: 'FIXED_OFF', amount: 15 } }],
        coupons: [{ id: 'coupon-min' }],
      },
    })

    const result = await service.validateCoupon('MINIMO50', 30, { tenantId: 'tenant_default', storeId: 'store_default' })

    expect(result.valid).toBe(false)
    expect(result.message).toContain('50,00')
    expect(result.message).toContain('20,00')
  })

  it('should tell the customer the coupon does not exist when nothing is found at all', async () => {
    mockPrismaService.coupon.findFirst.mockResolvedValueOnce(null) // findCoupon (busca estrita)
    mockPrismaService.coupon.findFirst.mockResolvedValueOnce(null) // explainInvalidCoupon (busca livre)

    const result = await service.validateCoupon('NAOEXISTE', 100, { tenantId: 'tenant_default', storeId: 'store_default' })

    expect(result.valid).toBe(false)
    expect(result.message).toContain('Não encontramos esse cupom')
  })

  it('should tell the customer when the coupon has already expired', async () => {
    const past = new Date(Date.now() - 60_000)
    mockPrismaService.coupon.findFirst.mockResolvedValueOnce(null) // findCoupon: fora da vigencia, nao acha
    mockPrismaService.coupon.findFirst.mockResolvedValueOnce({
      status: 'ACTIVE',
      promotion: { status: 'ACTIVE', startsAt: past, endsAt: past },
    })

    const result = await service.validateCoupon('VENCIDO', 100, { tenantId: 'tenant_default', storeId: 'store_default' })

    expect(result.valid).toBe(false)
    expect(result.message).toContain('já venceu')
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

  describe('JON-187: promocao com prazo segue a data da entrega, nao a do pedido', () => {
    beforeEach(() => {
      // Sem price list nesses testes -- senao ela sempre venceria o
      // promotionalPrice e a regra nova nunca entraria em jogo.
      mockPrismaService.priceList.findMany.mockResolvedValue([])
      mockPrismaService.priceListItem.findMany.mockResolvedValue([])
      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          ean: '789',
          name: 'Vinho em promocao',
          category: 'ADEGA_VINHOS_ESPUMANTES',
          tenantId: 'tenant_default',
          storeId: 'store_default',
          price: 100,
          promotionalPrice: 70,
          promotionalPriceValidUntil: new Date('2026-09-18T23:59:59.999Z'),
          active: true,
          syncOption: 'ESTOQUE',
        },
      ])
    })

    it('cobra o preco promocional quando a entrega cai dentro da vigencia', async () => {
      const quote = await service.quote({
        tenantId: 'tenant_default',
        storeId: 'store_default',
        items: [{ productId: 'prod-1', quantity: 1 }],
        deliveryDate: '2026-09-18T20:00:00-03:00',
      })

      expect(quote.items[0].unitPrice).toBe(70)
    })

    it('cobra o preco de tabela quando a entrega cai depois da vigencia', async () => {
      const quote = await service.quote({
        tenantId: 'tenant_default',
        storeId: 'store_default',
        items: [{ productId: 'prod-1', quantity: 1 }],
        deliveryDate: '2026-09-19T08:00:00-03:00',
      })

      expect(quote.items[0].unitPrice).toBe(100)
    })

    it('sem deliveryDate (preview/simulacao), preserva o comportamento antigo: promocao sempre vale', async () => {
      const quote = await service.quote({
        tenantId: 'tenant_default',
        storeId: 'store_default',
        items: [{ productId: 'prod-1', quantity: 1 }],
      })

      expect(quote.items[0].unitPrice).toBe(70)
    })

    it('promocao sem prazo (promotionalPriceValidUntil null) sempre vale, mesmo com deliveryDate', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: 'prod-1', ean: '789', name: 'Sem prazo', category: 'MERCEARIA', tenantId: 'tenant_default', storeId: 'store_default',
          price: 100, promotionalPrice: 70, promotionalPriceValidUntil: null, active: true, syncOption: 'ESTOQUE',
        },
      ])

      const quote = await service.quote({
        tenantId: 'tenant_default',
        storeId: 'store_default',
        items: [{ productId: 'prod-1', quantity: 1 }],
        deliveryDate: '2030-01-01T00:00:00-03:00',
      })

      expect(quote.items[0].unitPrice).toBe(70)
    })
  })
})
