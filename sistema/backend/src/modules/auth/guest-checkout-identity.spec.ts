import { ConflictException } from '@nestjs/common'
import { AuthService } from './auth.service'

/**
 * JON-131 (Auditoria 360, Urgent): guestCheckout casava cliente existente por
 * QUALQUER identificador (whatsapp OU cpf OU email) e emitia o JWT completo
 * dela, mesmo em conta protegida por senha -- so o e-mail da vitima bastava,
 * sem provar telefone nem CPF. Teste de abuso: fica vermelho se a regressao
 * voltar.
 */
const build = (customer: Record<string, unknown> | null) => {
  const jwt = { sign: jest.fn().mockReturnValue('token') }
  const prisma = {
    customer: {
      findFirst: jest.fn().mockResolvedValue(customer),
      update: jest.fn().mockResolvedValue(customer),
      create: jest.fn().mockResolvedValue({ id: 'novo', name: 'Novo', whatsapp: '21988887777', cpf: '11144477735' }),
    },
  }
  const service = new AuthService(prisma as never, jwt as never, {} as never)
  return { service, jwt, prisma }
}

describe('guestCheckout — identidade (JON-131)', () => {
  it('nao emite token so por casar o e-mail de uma conta com senha (atacante nao sabe whatsapp/cpf reais)', async () => {
    const { service } = build({
      id: 'vitima', email: 'vitima@exemplo.com', whatsapp: '21900000000', cpf: '52998224725',
      password: '$2b$10$hashvalido', // conta protegida -- se cadastrou de verdade
    })

    await expect(
      service.guestCheckout({
        name: 'Atacante',
        whatsapp: '11955554444', // diferente da vitima
        cpf: '15350946056', // diferente da vitima
        email: 'vitima@exemplo.com', // so isso bate
      } as never),
    ).rejects.toThrow(ConflictException)
  })

  it('conta guest sem senha continua reconhecendo o cliente que volta (comportamento original preservado)', async () => {
    const { service, jwt } = build({
      id: 'cliente-guest', name: 'Cliente', email: null, whatsapp: '21900000000', cpf: '52998224725',
      password: null, // origem guest_checkout, nunca definiu senha
    })

    const result = await service.guestCheckout({
      name: 'Cliente',
      whatsapp: '21900000000',
      cpf: '52998224725',
    } as never)

    expect(result.access_token).toBe('token')
    expect(jwt.sign).toHaveBeenCalled()
  })

  it('cliente novo (sem nenhum match) continua criando conta e logando normalmente', async () => {
    const { service, jwt, prisma } = build(null)

    const result = await service.guestCheckout({
      name: 'Novo',
      whatsapp: '21988887777',
      cpf: '11144477735',
    } as never)

    expect(prisma.customer.create).toHaveBeenCalled()
    expect(result.access_token).toBe('token')
    expect(jwt.sign).toHaveBeenCalled()
  })
})

describe('guestCheckout — CPF e WhatsApp juntos (01/10/2026)', () => {
  const build = (existing: Record<string, unknown> | null) => {
    const prisma = { customer: { findFirst: jest.fn().mockResolvedValue(existing), create: jest.fn(), update: jest.fn() } }
    const jwt = { sign: jest.fn().mockReturnValue('token') }
    const { AuthService } = jest.requireActual('./auth.service')
    return new AuthService(prisma as never, jwt as never, {} as never)
  }
  const guest = { id: 'g', name: 'Cliente', email: null, whatsapp: '21900000000', cpf: '52998224725', password: null, blocked: false }

  it('so o CPF de outra pessoa nao devolve a conta dela', async () => {
    await expect(build(guest).guestCheckout({ name: 'X', whatsapp: '21911112222', cpf: '52998224725' } as never)).rejects.toThrow('outro cadastro')
  })
  it('CPF invalido e recusado antes de qualquer busca', async () => {
    await expect(build(null).guestCheckout({ name: 'X', whatsapp: '21911112222', cpf: '12345678900' } as never)).rejects.toThrow('CPF inválido')
  })
  it('cadastro antigo com CPF invalido: mesmo WhatsApp e CPF valido corrige o CPF', async () => {
    const prisma = { customer: { findFirst: jest.fn().mockResolvedValueOnce({ ...guest, cpf: '19700000000' }).mockResolvedValueOnce(null), create: jest.fn(), update: jest.fn().mockResolvedValue({ ...guest }) } }
    const { AuthService } = jest.requireActual('./auth.service')
    const service = new AuthService(prisma as never, { sign: jest.fn().mockReturnValue('t') } as never, {} as never)
    await service.guestCheckout({ name: 'Cliente', whatsapp: '21900000000', cpf: '52998224725' } as never)
    expect(prisma.customer.update).toHaveBeenCalledWith({ where: { id: 'g' }, data: { cpf: '52998224725' } })
  })
})
