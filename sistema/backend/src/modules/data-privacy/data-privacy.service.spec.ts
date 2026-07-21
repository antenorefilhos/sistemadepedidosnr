import { BadRequestException } from '@nestjs/common'
import { DataPrivacyService } from './data-privacy.service'

const mockPrisma: any = {
  customer: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  customerConsent: {
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
  analyticsEvent: {
    findMany: jest.fn(),
  },
  recommendationEvent: {
    findMany: jest.fn(),
  },
  dataSubjectRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  order: {
    count: jest.fn(),
  },
  address: {
    updateMany: jest.fn(),
  },
  customerProfile: {
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
}

const mockAuditLog: any = {
  log: jest.fn(),
}

describe('DataPrivacyService', () => {
  let service: DataPrivacyService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new DataPrivacyService(mockPrisma, mockAuditLog)
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'customer-1' })
  })

  it('records LGPD consent bundle for terms, privacy and channels with audit', async () => {
    mockPrisma.customerConsent.upsert.mockResolvedValue({ id: 'consent-1', status: 'OPT_IN' })

    const result = await service.upsertConsentBundle('customer-1', {
      consents: [
        { type: 'terms', status: 'opt_in' },
        { type: 'privacy', status: 'opt_in' },
        { type: 'whatsapp', status: 'opt_out' },
      ],
    }, { tenantId: 'tenant_default', storeId: 'store_default', actorId: 'admin-1' })

    expect(result.consents).toHaveLength(3)
    expect(mockPrisma.customerConsent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_customerId_type: { tenantId: 'tenant_default', customerId: 'customer-1', type: 'TERMS' } },
    }))
    expect(mockAuditLog.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LGPD_CONSENTS_UPSERTED',
      entityId: 'customer-1',
      adminId: 'admin-1',
    }))
  })

  it('exports customer data and creates an executable data subject request', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'customer-1',
      orders: [{ id: 'order-1', items: [] }],
      consents: [{ id: 'consent-1' }],
      addresses: [],
      profile: null,
      loyaltyAccount: null,
      campaignDeliveries: [],
      shoppingLists: [],
    })
    mockPrisma.analyticsEvent.findMany.mockResolvedValue([{ id: 'event-1' }])
    mockPrisma.recommendationEvent.findMany.mockResolvedValue([{ id: 'rec-1' }])
    mockPrisma.dataSubjectRequest.create.mockResolvedValue({ id: 'dsr-1', type: 'EXPORT', status: 'COMPLETED' })

    const result = await service.exportCustomerData('customer-1', { tenantId: 'tenant_default', storeId: 'store_default' })

    expect(result.request.status).toBe('COMPLETED')
    expect(result.data.analyticsEvents).toHaveLength(1)
    expect(mockAuditLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LGPD_DATA_EXPORTED' }))
  })

  it('blocks anonymization while customer has active orders unless forced', async () => {
    mockPrisma.order.count.mockResolvedValue(1)

    await expect(service.anonymizeCustomer('customer-1', {}, { tenantId: 'tenant_default', storeId: 'store_default' }))
      .rejects.toThrow(BadRequestException)
  })

  it('anonymizes customer PII, revokes consents and audits sensitive change', async () => {
    mockPrisma.order.count.mockResolvedValue(0)
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback({
      customer: { update: jest.fn().mockResolvedValue({ id: 'customer-1', name: 'Cliente anonimizado tomer-1' }) },
      address: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      customerProfile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      customerConsent: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
      dataSubjectRequest: { create: jest.fn().mockResolvedValue({ id: 'dsr-2', status: 'COMPLETED' }) },
    }))

    const result = await service.anonymizeCustomer('customer-1', { reason: 'pedido do titular' }, {
      tenantId: 'tenant_default',
      storeId: 'store_default',
      actorId: 'admin-1',
    })

    expect(result.request.status).toBe('COMPLETED')
    expect(mockAuditLog.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LGPD_CUSTOMER_ANONYMIZED',
      adminId: 'admin-1',
    }))
  })
})
