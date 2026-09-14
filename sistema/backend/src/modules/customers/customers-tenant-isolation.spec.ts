import { NotFoundException } from '@nestjs/common'
import { CustomersService } from './customers.service'

// JON-142 (Auditoria 360, High): nenhum metodo aqui filtrava por tenant --
// admin do tenant A listava/lia/editava/bloqueava/apagava cliente do tenant
// B so por adivinhar o id. Fixture com dois tenants prova o isolamento.
const build = () => {
  const store = new Map<string, Record<string, unknown>>([
    ['c-a', { id: 'c-a', tenantId: 'tenant_a', name: 'Cliente A', cpf: '1', whatsapp: '1' }],
    ['c-b', { id: 'c-b', tenantId: 'tenant_b', name: 'Cliente B', cpf: '2', whatsapp: '2' }],
  ])
  const prisma = {
    customer: {
      findMany: jest.fn(({ where }: any) => Promise.resolve([...store.values()].filter((c) => c.tenantId === where.tenantId))),
      findFirst: jest.fn(({ where }: any) => Promise.resolve([...store.values()].find((c) => c.id === where.id && c.tenantId === where.tenantId) || null)),
      updateMany: jest.fn(({ where }: any) => {
        const match = [...store.values()].find((c) => c.id === where.id && c.tenantId === where.tenantId)
        return Promise.resolve({ count: match ? 1 : 0 })
      }),
      deleteMany: jest.fn(({ where }: any) => {
        const match = [...store.values()].find((c) => c.id === where.id && c.tenantId === where.tenantId)
        return Promise.resolve({ count: match ? 1 : 0 })
      }),
      update: jest.fn(({ where, data }: any) => Promise.resolve({ ...store.get(where.id), ...data })),
      create: jest.fn(),
    },
    pushSubscription: { groupBy: jest.fn().mockResolvedValue([]) },
  }
  const integrations = { syncCrmContact: jest.fn().mockResolvedValue(undefined) }
  const service = new CustomersService(prisma as never, integrations as never)
  return { service, prisma }
}

describe('CustomersService — isolamento por tenant (JON-142)', () => {
  it('findAll do tenant A nao devolve cliente do tenant B', async () => {
    const { service } = build()
    const result = await service.findAll({ tenantId: 'tenant_a' })
    expect(result.map((c: any) => c.id)).toEqual(['c-a'])
  })

  it('findOne com id de outro tenant devolve null, nao o registro', async () => {
    const { service } = build()
    const result = await service.findOne('c-b', { tenantId: 'tenant_a' })
    expect(result).toBeNull()
  })

  it('update com id de outro tenant recusa (nao muta a linha)', async () => {
    const { service } = build()
    await expect(service.update('c-b', { name: 'Invadido' }, { tenantId: 'tenant_a' })).rejects.toBeInstanceOf(NotFoundException)
  })

  it('remove com id de outro tenant recusa', async () => {
    const { service } = build()
    await expect(service.remove('c-b', { tenantId: 'tenant_a' })).rejects.toBeInstanceOf(NotFoundException)
  })

  it('setBlocked com id de outro tenant recusa', async () => {
    const { service } = build()
    await expect(service.setBlocked('c-b', true, { tenantId: 'tenant_a' })).rejects.toBeInstanceOf(NotFoundException)
  })

  it('create sempre grava o tenantId do contexto, nunca o do body', async () => {
    const { service, prisma } = build()
    prisma.customer.findFirst = jest.fn().mockResolvedValue(null)
    prisma.customer.create = jest.fn().mockResolvedValue({ id: 'c-new' })
    await service.create({ name: 'Novo', cpf: '3', whatsapp: '3', tenantId: 'tenant_b' } as never, { tenantId: 'tenant_a' })
    expect(prisma.customer.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant_a' }),
    }))
  })
})
