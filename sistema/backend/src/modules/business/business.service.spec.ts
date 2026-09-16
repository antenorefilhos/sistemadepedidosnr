import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { BusinessService } from './business.service'

const baseAccount = {
  id: 'account-1',
  tenantId: 'tenant_default',
  storeId: 'store_default',
  name: 'Empresa Teste',
  creditLimit: 200,
}

const buildService = () => {
  const prisma: any = {
    businessAccount: { findFirst: jest.fn().mockResolvedValue(baseAccount) },
    order: {
      aggregate: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    businessAccountUser: { count: jest.fn().mockResolvedValue(1) },
    priceList: { create: jest.fn(), findUnique: jest.fn() },
    priceListItem: { createMany: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((fn: any) => fn(prisma)),
  }
  const ordersService: any = {
    sendApprovalWhatsApp: jest.fn().mockResolvedValue(null),
  }
  const orderOrchestrationService: any = {
    retryOrderSync: jest.fn().mockResolvedValue({ orderId: 'o1', retried: true, success: true }),
  }
  const integrationsService: any = {
    syncFiscalDocument: jest.fn().mockResolvedValue({ success: true }),
    syncChargePayment: jest.fn().mockResolvedValue({ success: true }),
  }
  const service = new BusinessService(prisma, ordersService, orderOrchestrationService, integrationsService)
  return { service, prisma, ordersService, integrationsService, orderOrchestrationService }
}

describe('BusinessService (Auditoria 360)', () => {
  // JON-123 (Medium): usedCredit somava pedido PAGO como divida em aberto.
  describe('getFinancialSummary', () => {
    it('exclui pedidos PAID/REFUNDED do credito consumido', async () => {
      const { service, prisma } = buildService()
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: 50 }, _count: { _all: 1 } })

      const result = await service.getFinancialSummary('account-1')

      expect(prisma.order.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentStatus: { notIn: ['PAID', 'REFUNDED'] } }),
        }),
      )
      expect(result.usedCredit).toBe(50)
      expect(result.availableCredit).toBe(150)
    })
  })

  // JON-124 (Medium): pai criado antes de validar itens, sem transacao.
  describe('createAccountPriceList', () => {
    it('recusa preco <= 0 sem criar nada', async () => {
      const { service, prisma } = buildService()
      await expect(
        service.createAccountPriceList('account-1', undefined, {
          items: [{ productId: 'prod-1', price: 0 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(prisma.priceList.create).not.toHaveBeenCalled()
    })

    it('recusa productId repetido sem criar nada', async () => {
      const { service, prisma } = buildService()
      await expect(
        service.createAccountPriceList('account-1', undefined, {
          items: [
            { productId: 'prod-1', price: 10 },
            { productId: 'prod-1', price: 20 },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(prisma.priceList.create).not.toHaveBeenCalled()
    })

    it('cria pai e itens juntos numa transacao quando tudo e valido', async () => {
      const { service, prisma } = buildService()
      prisma.priceList.create.mockResolvedValue({ id: 'pl-1' })
      prisma.priceList.findUnique.mockResolvedValue({ id: 'pl-1', items: [{ productId: 'prod-1' }] })

      await service.createAccountPriceList('account-1', undefined, {
        items: [{ productId: 'prod-1', price: 10 }],
      })

      expect(prisma.$transaction).toHaveBeenCalled()
      expect(prisma.priceListItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [expect.objectContaining({ priceListId: 'pl-1', productId: 'prod-1' })] }),
      )
    })
  })

  // JON-125 (Medium): so rejeitava PENDING -- CANCELLED/REFUNDED/PAID e
  // aprovacao != APPROVED (ex.: REJECTED) passavam e disparavam conectores.
  describe('runBillingForOrder', () => {
    const runBilling = (order: any) => {
      const { service, prisma, integrationsService } = buildService()
      prisma.order.findFirst.mockResolvedValue(order)
      return { service, prisma, integrationsService }
    }

    it.each([
      ['REJECTED aprovacao', { id: 'o1', businessAccountId: 'a1', businessApprovalStatus: 'REJECTED', status: 'PENDING', paymentStatus: 'UNPAID' }],
      ['CANCELLED', { id: 'o1', businessAccountId: 'a1', businessApprovalStatus: 'APPROVED', status: 'CANCELLED', paymentStatus: 'UNPAID' }],
      ['REFUNDED', { id: 'o1', businessAccountId: 'a1', businessApprovalStatus: 'APPROVED', status: 'REFUNDED', paymentStatus: 'UNPAID' }],
      ['ja PAID', { id: 'o1', businessAccountId: 'a1', businessApprovalStatus: 'APPROVED', status: 'DELIVERED', paymentStatus: 'PAID' }],
    ])('recusa faturar pedido %s, zero chamadas externas', async (_label, order) => {
      const { service, integrationsService } = runBilling(order)
      await expect(service.runBillingForOrder('o1', undefined)).rejects.toBeInstanceOf(BadRequestException)
      expect(integrationsService.syncFiscalDocument).not.toHaveBeenCalled()
      expect(integrationsService.syncChargePayment).not.toHaveBeenCalled()
    })

    it('pedido elegivel (APPROVED, nao cancelado/reembolsado, nao pago) chama os dois conectores', async () => {
      const { service, integrationsService } = runBilling({
        id: 'o1', businessAccountId: 'a1', businessApprovalStatus: 'APPROVED', status: 'DELIVERED', paymentStatus: 'UNPAID',
      })
      const result = await service.runBillingForOrder('o1', undefined)
      expect(integrationsService.syncFiscalDocument).toHaveBeenCalledWith('o1')
      expect(integrationsService.syncChargePayment).toHaveBeenCalledWith('o1')
      expect(result.orderId).toBe('o1')
    })
  })

  // JON-128 (Medium): so conferia businessApprovalStatus, nao o status do
  // pedido -- CANCELLED com aprovacao ainda PENDING era reaberto. JON-130
  // (Medium): aprovar so mudava o banco, sem disparar o sync/whatsapp que
  // ficou pendente na criacao.
  describe('approveOrder', () => {
    it('CANCELLED com aprovacao PENDING nao e reaberto', async () => {
      const { service, prisma } = buildService()
      prisma.order.findFirst.mockResolvedValue(null) // where inclui status:'PENDING_APPROVAL'

      await expect(service.approveOrder('o1', undefined)).rejects.toBeInstanceOf(NotFoundException)
      expect(prisma.order.updateMany).not.toHaveBeenCalled()
    })

    it('corrida: segunda chamada concorrente recebe Conflict, nao reaprova', async () => {
      const { service, prisma } = buildService()
      prisma.order.findFirst.mockResolvedValue({ id: 'o1', status: 'PENDING_APPROVAL', businessApprovalStatus: 'PENDING' })
      prisma.order.updateMany.mockResolvedValue({ count: 0 }) // outra chamada already venceu

      await expect(service.approveOrder('o1', undefined, 'admin-1')).rejects.toBeInstanceOf(ConflictException)
    })

    it('aprovacao bem sucedida dispara sync ERP e WhatsApp exatamente uma vez', async () => {
      const { service, prisma, ordersService, orderOrchestrationService } = buildService()
      prisma.order.findFirst.mockResolvedValue({ id: 'o1', status: 'PENDING_APPROVAL', businessApprovalStatus: 'PENDING' })
      prisma.order.updateMany.mockResolvedValue({ count: 1 })
      prisma.order.findUniqueOrThrow.mockResolvedValue({ id: 'o1', status: 'PENDING', businessApprovalStatus: 'APPROVED' })

      const result = await service.approveOrder('o1', undefined, 'admin-1')

      expect(result.businessApprovalStatus).toBe('APPROVED')
      expect(orderOrchestrationService.retryOrderSync).toHaveBeenCalledTimes(1)
      expect(orderOrchestrationService.retryOrderSync).toHaveBeenCalledWith('o1')
      expect(ordersService.sendApprovalWhatsApp).toHaveBeenCalledTimes(1)
      expect(ordersService.sendApprovalWhatsApp).toHaveBeenCalledWith('o1')
    })
  })

  // JON-126 (Medium): lote nao excluia pedido ja PAID -- ocupava vaga do
  // take() pra sempre e pedidos novos nunca eram atingidos.
  describe('runBillingForAccount', () => {
    it('exclui paymentStatus PAID da selecao do lote', async () => {
      const { service, prisma } = buildService()
      prisma.order.findMany.mockResolvedValue([])

      await service.runBillingForAccount('account-1', undefined, { limit: 5 })

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentStatus: { not: 'PAID' } }),
        }),
      )
    })
  })
})
