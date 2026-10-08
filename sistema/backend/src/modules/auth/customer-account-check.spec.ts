import { AuthService } from './auth.service'

// Checkout convidado (08/10/2026): abre o login quando os dados ja sao de uma conta com senha.
const build = (found: Record<string, unknown> | null) => {
  const prisma = { customer: { findFirst: jest.fn().mockResolvedValue(found) } }
  const service = new AuthService(prisma as never, {} as never, {} as never)
  return { service, prisma }
}

describe('customerAccountCheck', () => {
  it('conta com senha pelo WhatsApp: avisa e diz por qual dado', async () => {
    const { service, prisma } = build({ whatsapp: '24999990000', cpf: '12345678909', email: null })
    await expect(service.customerAccountCheck({ whatsapp: '(24) 99999-0000', cpf: '000.000.000-00' })).resolves.toEqual({ exists: true, via: 'whatsapp' })
    expect(prisma.customer.findFirst.mock.calls[0][0].where.password).toEqual({ not: null })
  })

  it('sem conta com senha, ou dado incompleto: nao consulta / nao existe', async () => {
    const { service, prisma } = build(null)
    await expect(service.customerAccountCheck({ whatsapp: '2499' })).resolves.toEqual({ exists: false })
    expect(prisma.customer.findFirst).not.toHaveBeenCalled()
    await expect(service.customerAccountCheck({ cpf: '12345678909' })).resolves.toEqual({ exists: false })
  })

  it('e-mail gerado do convidado nao conta', async () => {
    const { service, prisma } = build(null)
    await service.customerAccountCheck({ email: 'guest.24999990000@checkout.local' })
    expect(prisma.customer.findFirst).not.toHaveBeenCalled()
  })
})
