import { CustomersService } from './customers.service'

// JON-44 (Auditoria 360, Medium): findAll sem take/skip cresce sem limite
// com o cadastro. Cap defensivo evita payload/memoria ilimitados.
const build = () => {
  const prisma = {
    customer: { findMany: jest.fn().mockResolvedValue([]) },
    pushSubscription: { groupBy: jest.fn().mockResolvedValue([]) },
  }
  const integrations = { syncCrmContact: jest.fn() }
  const service = new CustomersService(prisma as never, integrations as never)
  return { service, prisma }
}

describe('CustomersService.findAll — limite defensivo (JON-44)', () => {
  it('usa o cap maximo quando nenhum limite e informado', async () => {
    const { service, prisma } = build()
    await service.findAll({ tenantId: 'tenant_a' })
    expect(prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }))
  })

  it('respeita um limite menor explicito', async () => {
    const { service, prisma } = build()
    await service.findAll({ tenantId: 'tenant_a' }, undefined, 50)
    expect(prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }))
  })

  it('nao deixa um limite acima do cap escapar', async () => {
    const { service, prisma } = build()
    await service.findAll({ tenantId: 'tenant_a' }, undefined, 999999)
    expect(prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }))
  })
})
