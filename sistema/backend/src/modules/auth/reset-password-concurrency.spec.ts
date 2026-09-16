import { BadRequestException } from '@nestjs/common'
import { AuthService } from './auth.service'

// JON-139 (Auditoria 360): duas requisicoes concorrentes com o mesmo token de
// reset nao podem as duas trocar a senha -- ler-depois-escrever por id deixava
// as duas passarem. updateMany com o mesmo where do findFirst faz a segunda
// nao achar mais a linha (ja consumida pela primeira) e falhar com count 0.
const build = (recordFound: Record<string, unknown> | null) => {
  const state = { consumed: false }
  const prisma = {
    admin: {
      findFirst: jest.fn().mockResolvedValue(recordFound),
      updateMany: jest.fn().mockImplementation(async () => {
        if (state.consumed) return { count: 0 }
        state.consumed = true
        return { count: 1 }
      }),
    },
    customer: {
      findFirst: jest.fn().mockResolvedValue(recordFound),
      updateMany: jest.fn().mockImplementation(async () => {
        if (state.consumed) return { count: 0 }
        state.consumed = true
        return { count: 1 }
      }),
    },
  }
  const service = new AuthService(prisma as never, {} as never, {} as never)
  return { service, prisma }
}

describe('reset de senha sob concorrencia (JON-139)', () => {
  it('admin: duas chamadas concorrentes com o mesmo token -- so uma troca a senha', async () => {
    const { service } = build({ id: 'admin-1' })

    const [first, second] = await Promise.allSettled([
      service.resetPassword('token-valido', 'novaSenha123'),
      service.resetPassword('token-valido', 'outraSenha456'),
    ])

    const results = [first, second]
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toBeInstanceOf(BadRequestException)
  })

  it('customer: duas chamadas concorrentes com o mesmo token -- so uma troca a senha', async () => {
    const { service } = build({ id: 'customer-1' })

    const [first, second] = await Promise.allSettled([
      service.customerResetPassword('token-valido', 'novaSenha123'),
      service.customerResetPassword('token-valido', 'outraSenha456'),
    ])

    const results = [first, second]
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
  })
})
