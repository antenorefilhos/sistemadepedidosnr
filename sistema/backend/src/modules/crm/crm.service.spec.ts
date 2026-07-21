import { BadRequestException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { CrmService } from './crm.service'

const mockPrisma: any = {
  customer: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  customerProfile: {
    upsert: jest.fn(),
  },
  customerConsent: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  customerSegment: {
    upsert: jest.fn(),
  },
  customerSegmentMember: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  loyaltyAccount: {
    upsert: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  loyaltyLedger: {
    create: jest.fn(),
  },
  campaign: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  campaignDelivery: {
    createMany: jest.fn(),
  },
  shoppingList: {
    create: jest.fn(),
  },
  order: {
    aggregate: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((cb: any) => cb(mockPrisma)),
}

describe('CrmService', () => {
  let service: CrmService

  beforeEach(() => {
    service = new CrmService(mockPrisma)
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'customer-1' })
    jest.clearAllMocks()
  })

  it('records consent as an auditable opt-in/opt-out contract', async () => {
    mockPrisma.customerConsent.upsert.mockResolvedValue({ id: 'consent-1', type: 'WHATSAPP', status: 'OPT_IN' })

    const result = await service.upsertConsent('customer-1', {
      type: 'whatsapp',
      status: 'opt_in',
      source: 'checkout',
    }, { ip: '127.0.0.1', userAgent: 'jest' })

    expect(result.status).toBe('OPT_IN')
    expect(mockPrisma.customerConsent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          type: 'WHATSAPP',
          status: 'OPT_IN',
          source: 'CHECKOUT',
          ip: '127.0.0.1',
        }),
      }),
    )
  })

  it('blocks loyalty redemption when the balance would become negative', async () => {
    mockPrisma.loyaltyAccount.upsert.mockResolvedValue({
      id: 'loyalty-1',
      points: new Prisma.Decimal('10'),
      cashback: new Prisma.Decimal('0'),
    })

    await expect(service.mutateLoyalty('customer-1', 'REDEEM', {
      points: -20,
      reason: 'Checkout',
    })).rejects.toThrow(BadRequestException)
    expect(mockPrisma.loyaltyLedger.create).not.toHaveBeenCalled()
  })

  it('writes loyalty ledger with resulting balance for cashback and points', async () => {
    mockPrisma.loyaltyAccount.upsert.mockResolvedValue({
      id: 'loyalty-1',
      points: new Prisma.Decimal('10'),
      cashback: new Prisma.Decimal('5'),
    })
    mockPrisma.loyaltyAccount.update.mockResolvedValue({
      id: 'loyalty-1',
      points: new Prisma.Decimal('15'),
      cashback: new Prisma.Decimal('7.5'),
      tier: 'BASIC',
    })
    mockPrisma.loyaltyLedger.create.mockResolvedValue({ id: 'ledger-1' })

    const result = await service.mutateLoyalty('customer-1', 'CREDIT', {
      points: 5,
      cashback: 2.5,
      reason: 'Pedido entregue',
      referenceType: 'ORDER',
      referenceId: 'order-1',
    })

    expect(result.ledger.id).toBe('ledger-1')
    expect(mockPrisma.loyaltyLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CREDIT',
          pointsDelta: expect.any(Prisma.Decimal),
          cashbackDelta: expect.any(Prisma.Decimal),
          pointsBalance: new Prisma.Decimal('15'),
          cashbackBalance: new Prisma.Decimal('7.5'),
          referenceId: 'order-1',
        }),
      }),
    )
  })

  it('dispatches campaign only to customers with channel consent', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue({
      id: 'campaign-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      channel: 'WHATSAPP',
      template: { body: 'Oferta' },
      segment: {
        members: [{ customerId: 'customer-1' }, { customerId: 'customer-2' }],
      },
    })
    mockPrisma.customerConsent.findMany.mockResolvedValue([
      { id: 'consent-1', customerId: 'customer-1', type: 'WHATSAPP', status: 'OPT_IN' },
    ])
    mockPrisma.campaignDelivery.createMany.mockResolvedValue({ count: 1 })
    mockPrisma.campaign.update.mockResolvedValue({})

    const result = await service.dispatchCampaign('campaign-1')

    expect(result).toEqual({ eligible: 2, consented: 1, blockedByConsent: 1 })
    expect(mockPrisma.campaignDelivery.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ customerId: 'customer-1', consentId: 'consent-1' })],
      }),
    )
  })

  it('creates a shopping list from a previous order for quick reorder', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      items: [
        { productId: 'prod-1', quantity: 2 },
        { productId: 'prod-2', quantity: 1 },
      ],
    })
    mockPrisma.shoppingList.create.mockImplementation(async ({ data }) => ({ id: 'list-1', ...data }))

    const result = await service.createShoppingListFromOrder('customer-1', { orderId: 'order-1', name: 'Minha recompra' })

    expect(result.id).toBe('list-1')
    expect(mockPrisma.shoppingList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'customer-1',
          name: 'Minha recompra',
          source: 'REORDER',
          items: expect.objectContaining({
            create: [
              expect.objectContaining({ productId: 'prod-1' }),
              expect.objectContaining({ productId: 'prod-2' }),
            ],
          }),
        }),
      }),
    )
  })
})
