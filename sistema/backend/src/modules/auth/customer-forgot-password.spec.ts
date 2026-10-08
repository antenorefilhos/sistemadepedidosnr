import { AuthService } from './auth.service'

// Esqueci minha senha do cliente (07/10/2026): pelo mesmo dado do login.
const build = (customer: Record<string, unknown> | null) => {
  const prisma = {
    customer: {
      findUnique: jest.fn().mockResolvedValue(customer),
      findFirst: jest.fn().mockResolvedValue(customer),
      update: jest.fn().mockResolvedValue({}),
    },
  }
  const email = { sendPasswordReset: jest.fn().mockResolvedValue(true) }
  const service = new AuthService(prisma as never, {} as never, email as never)
  return { service, prisma, email }
}
const cliente = { id: 'c1', name: 'Maria', email: 'maria@x.com', cpf: '12345678909', whatsapp: '24999990000' }

describe('customerForgotPassword', () => {
  it('acha pelo e-mail, CPF ou celular e manda para o e-mail do cadastro', async () => {
    for (const id of ['Maria@X.com', '123.456.789-09', '(24) 99999-0000']) {
      const { service, email } = build(cliente)
      await service.customerForgotPassword(id)
      expect(email.sendPasswordReset).toHaveBeenCalledWith('maria@x.com', 'Maria', expect.stringContaining('/redefinir-senha?token='))
    }
  })

  it('conta sem e-mail ou inexistente: resposta igual, nada enviado', async () => {
    for (const customer of [{ ...cliente, email: null }, null]) {
      const { service, email, prisma } = build(customer)
      const res = await service.customerForgotPassword('24999990000')
      expect(res.message).toMatch(/Se encontrarmos sua conta/)
      expect(email.sendPasswordReset).not.toHaveBeenCalled()
      expect(prisma.customer.update).not.toHaveBeenCalled()
    }
  })
})
