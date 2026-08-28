import { CustomersService } from './customers.service'

/**
 * A flag de push na lista de clientes. Errar o cruzamento aqui nao levanta
 * excecao nenhuma -- so mostra "ninguem ativou" pra sempre, que e indistinguivel
 * do estado real de 28/08/2026 (zero assinaturas). Por isso o teste existe.
 */
const build = (grouped: Array<{ customerId: string; _count: { _all: number } }>) => {
  const prisma = {
    customer: { findMany: jest.fn() },
    pushSubscription: { groupBy: jest.fn().mockResolvedValue(grouped) },
  }
  const service = new CustomersService(prisma as never, {} as never)
  return { service, prisma }
}

const CLIENTES = [
  { id: 'c1', name: 'Ana' },
  { id: 'c2', name: 'Bruno' },
]

describe('CustomersService — flag de push', () => {
  it('marca quem tem assinatura e conta os aparelhos', async () => {
    const { service, prisma } = build([{ customerId: 'c1', _count: { _all: 2 } }])
    prisma.customer.findMany.mockResolvedValue(CLIENTES)

    const [ana, bruno] = (await service.findAll()) as Array<Record<string, unknown>>
    expect(ana).toMatchObject({ id: 'c1', pushEnabled: true, pushSubscriptionCount: 2 })
    expect(bruno).toMatchObject({ id: 'c2', pushEnabled: false, pushSubscriptionCount: 0 })
  })

  it('cliente sem assinatura nenhuma vem com a flag falsa, nao ausente', async () => {
    // undefined faria a coluna do admin renderizar vazio em vez de "nao ativou".
    const { service, prisma } = build([])
    prisma.customer.findMany.mockResolvedValue(CLIENTES)

    const resultado = (await service.findAll()) as Array<Record<string, unknown>>
    for (const c of resultado) {
      expect(c.pushEnabled).toBe(false)
      expect(c.pushSubscriptionCount).toBe(0)
    }
  })

  it('nao consulta assinatura quando nao ha cliente', async () => {
    const { service, prisma } = build([])
    prisma.customer.findMany.mockResolvedValue([])

    await expect(service.findAll()).resolves.toEqual([])
    expect(prisma.pushSubscription.groupBy).not.toHaveBeenCalled()
  })

  it('vale tambem no caminho de busca por texto', async () => {
    const { service, prisma } = build([{ customerId: 'c2', _count: { _all: 1 } }])
    prisma.customer.findMany.mockResolvedValue([CLIENTES[1]])

    const [bruno] = (await service.findAll('Bruno')) as Array<Record<string, unknown>>
    expect(bruno).toMatchObject({ pushEnabled: true, pushSubscriptionCount: 1 })
  })
})
