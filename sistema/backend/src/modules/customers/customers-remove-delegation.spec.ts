import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CustomersService } from './customers.service'

// Exclusao de conta a pedido do titular (LGPD, 16/10/2026): remove() so
// delega pro DataPrivacyService.anonymizeCustomer (ja existia, com as
// correcoes JON-119/120/121/122 e AuditLogService) -- este spec cobre so a
// parte do CustomersService: ownership/idempotencia ja vem do controller e
// a logica de anonimizacao propriamente dita e testada em data-privacy.
const build = (existing: { id: string; deletedAt: Date | null } | null) => {
  const prisma = {
    customer: { findFirst: jest.fn().mockResolvedValue(existing) },
  }
  const dataPrivacy = { anonymizeCustomer: jest.fn() }
  const integrations = { syncCrmContact: jest.fn() }
  const service = new CustomersService(prisma as never, integrations as never, dataPrivacy as never)
  return { service, prisma, dataPrivacy }
}

describe('CustomersService.remove — delega para DataPrivacyService', () => {
  it('chama anonymizeCustomer e devolve id/deletedAt do customer anonimizado', async () => {
    const { service, dataPrivacy } = build({ id: 'cust-1', deletedAt: null })
    const anonymizedAt = new Date('2026-10-16T12:00:00Z')
    dataPrivacy.anonymizeCustomer.mockResolvedValue({ customer: { id: 'cust-1', deletedAt: anonymizedAt } })

    const result = await service.remove('cust-1', { tenantId: 'tenant_a' }, 'customer')

    expect(dataPrivacy.anonymizeCustomer).toHaveBeenCalledWith('cust-1', {}, { tenantId: 'tenant_a', actorId: 'customer' })
    expect(result).toEqual({ id: 'cust-1', deletedAt: anonymizedAt })
  })

  it('idempotente: conta ja excluida nao chama anonymizeCustomer de novo', async () => {
    const already = new Date('2026-10-01T00:00:00Z')
    const { service, dataPrivacy } = build({ id: 'cust-1', deletedAt: already })

    const result = await service.remove('cust-1', { tenantId: 'tenant_a' }, 'customer')

    expect(dataPrivacy.anonymizeCustomer).not.toHaveBeenCalled()
    expect(result).toEqual({ id: 'cust-1', deletedAt: already })
  })

  it('cliente inexistente no tenant recusa com NotFoundException', async () => {
    const { service } = build(null)
    await expect(service.remove('cust-x', { tenantId: 'tenant_a' }, 'customer')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('troca a mensagem tecnica de pedido ativo por uma que o cliente entende', async () => {
    const { service, dataPrivacy } = build({ id: 'cust-1', deletedAt: null })
    dataPrivacy.anonymizeCustomer.mockRejectedValue(new BadRequestException('Cliente possui pedidos ativos; anonimização exige force=true ou encerramento operacional.'))

    await expect(service.remove('cust-1', { tenantId: 'tenant_a' }, 'customer')).rejects.toMatchObject({
      response: { message: expect.stringContaining('pedido em andamento') },
    })
  })
})
