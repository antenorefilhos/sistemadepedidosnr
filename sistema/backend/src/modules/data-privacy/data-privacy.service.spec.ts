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

  // JON-129: body sem consents (ou nao-array) nao pode virar opt-in em
  // todos os canais -- exige que os canais desejados venham explicitos.
  it.each([
    ['sem consents', {}],
    ['consents vazio', { consents: [] }],
    ['consents nao-array', { consents: 'TERMS' }],
  ])('rejects consent bundle %s sem escrever nada', async (_label, body) => {
    await expect(service.upsertConsentBundle('customer-1', body, { tenantId: 'tenant_default', storeId: 'store_default' }))
      .rejects.toThrow(BadRequestException)
    expect(mockPrisma.customerConsent.upsert).not.toHaveBeenCalled()
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

  // JON-122: !body.force tratava 'false' (string) como truthy -- so o
  // boolean true explicito pode furar a trava de pedidos ativos.
  it.each([
    ['ausente', undefined],
    ['string false', 'false'],
    ['string true', 'true'],
    ['numero 1', 1],
    ['objeto vazio', {}],
  ])('rejeita pedidos ativos quando force e %s (nao e boolean true)', async (_label, forceValue) => {
    mockPrisma.order.count.mockResolvedValue(1)

    await expect(
      service.anonymizeCustomer('customer-1', { force: forceValue }, { tenantId: 'tenant_default', storeId: 'store_default' }),
    ).rejects.toThrow(BadRequestException)
  })

  it('aceita apenas o boolean true explicito como forca', async () => {
    mockPrisma.order.count.mockResolvedValue(1)
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback({
      customer: { update: jest.fn().mockResolvedValue({ id: 'customer-1' }) },
      pushSubscription: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      address: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      customerProfile: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      customerConsent: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dataSubjectRequest: { create: jest.fn().mockResolvedValue({ id: 'dsr-3', status: 'COMPLETED' }) },
    }))

    const result = await service.anonymizeCustomer('customer-1', { force: true }, { tenantId: 'tenant_default', storeId: 'store_default' })

    expect(result.request.status).toBe('COMPLETED')
  })

  it('anonymizes customer PII, revokes consents and audits sensitive change', async () => {
    mockPrisma.order.count.mockResolvedValue(0)
    const customerUpdate = jest.fn().mockResolvedValue({ id: 'customer-1', name: 'Cliente anonimizado tomer-1' })
    const pushDeleteMany = jest.fn().mockResolvedValue({ count: 2 })
    const addressUpdateMany = jest.fn().mockResolvedValue({ count: 1 })
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback({
      customer: { update: customerUpdate },
      pushSubscription: { deleteMany: pushDeleteMany },
      address: { updateMany: addressUpdateMany },
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

    // JON-119: sem isso, JWT/reset/push emitidos antes da anonimizacao
    // continuavam validos e reabriam acesso a conta anonimizada.
    expect(customerUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        password: null,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        tokenVersion: { increment: 1 },
        blocked: true,
      }),
    }))
    expect(pushDeleteMany).toHaveBeenCalledWith({ where: { customerId: 'customer-1' } })

    // JON-120: locality/deliveryPointCode nao eram zerados -- referencia a
    // condominio/localidade especifica sobrevivia ao endereco "anonimizado".
    expect(addressUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ locality: null, deliveryPointCode: null }),
    }))
  })

  // JON-121: take:1000 sem cursor truncava a exportacao em silencio; agora
  // pagina ate esgotar as duas colecoes.
  it('exporta mais de 1000 eventos por colecao sem truncar', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'customer-1', orders: [], consents: [], addresses: [], profile: null,
      loyaltyAccount: null, campaignDeliveries: [], shoppingLists: [],
    })
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: `evt-${i}` }))
    const page2 = [{ id: 'evt-1000' }]
    mockPrisma.analyticsEvent.findMany
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2)
    mockPrisma.recommendationEvent.findMany.mockResolvedValue([])
    mockPrisma.dataSubjectRequest.create.mockResolvedValue({ id: 'dsr-4', status: 'COMPLETED' })

    const result = await service.exportCustomerData('customer-1', { tenantId: 'tenant_default', storeId: 'store_default' })

    expect(result.data.analyticsEvents).toHaveLength(1001)
    expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalledTimes(2)
  })
})
