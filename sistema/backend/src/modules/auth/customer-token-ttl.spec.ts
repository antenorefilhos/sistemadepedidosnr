import * as bcrypt from 'bcrypt'
import { AuthService } from './auth.service'

/**
 * Cliente fica logado 30 dias; equipe continua nas 24h do padrao do modulo.
 *
 * Isto e o tipo de coisa que regride calada: alguem mexe no `signOptions` do
 * AuthModule "pra padronizar" e ou derruba o cliente todo dia, ou estende a
 * sessao de quem opera a loja. O teste existe pra isso doer no CI.
 */
const build = (customer: Record<string, unknown> | null, admin: Record<string, unknown> | null = null) => {
  const jwt = { sign: jest.fn().mockReturnValue('token') }
  const prisma = {
    customer: { findFirst: jest.fn().mockResolvedValue(customer), findUnique: jest.fn().mockResolvedValue(customer) },
    admin: { findUnique: jest.fn().mockResolvedValue(admin) },
    // login() de admin passa por grantDefaultAdminAccess antes de assinar.
    userStoreAccess: { findFirst: jest.fn().mockResolvedValue({ id: 'acesso' }) },
  }
  const service = new AuthService(prisma as never, jwt as never, {} as never)
  return { service, jwt, prisma }
}

describe('validade do token', () => {
  it('cliente recebe 30 dias', async () => {
    const senha = await bcrypt.hash('segredo123', 10)
    const { service, jwt } = build({
      id: 'c1', email: 'a@b.com', name: 'Cliente', cpf: '00000000000', whatsapp: '21999999999', password: senha,
    })

    await service.customerLogin({ identifier: 'a@b.com', password: 'segredo123' } as never)

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'customer' }),
      { expiresIn: '30d' },
    )
  })

  // O painel mexe em preco, catalogo e equipe, e roda no computador da loja
  // -- nao tem o problema de estar no bolso de alguem.
  it('admin fica no padrao de 24h do modulo', async () => {
    const senha = await bcrypt.hash('segredo123', 10)
    const { service, jwt } = build(null, {
      id: 'a1', email: 'admin@loja.com', name: 'Admin', role: 'admin', password: senha, tenantId: 't1',
    })

    await service.login({ email: 'admin@loja.com', password: 'segredo123' } as never)

    const [, opcoes] = jwt.sign.mock.calls[0]
    expect(opcoes).toBeUndefined()
  })

  // O app roda no celular do funcionario e precisa da sessao viva pra avisar
  // quem esta com o aparelho na mao -- pedir login a cada turno mata o app.
  it.each(['picker', 'driver'])('%s recebe sessao longa', async (role) => {
    const senha = await bcrypt.hash('segredo123', 10)
    const { service, jwt } = build(null, {
      id: 's1', email: 'sep@loja.com', name: 'Separador', role, password: senha, tenantId: 't1',
      moduleAccess: ['picking'],
    })

    await service.login({ email: 'sep@loja.com', password: 'segredo123' } as never)

    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ role }), { expiresIn: '30d' })
  })
})
